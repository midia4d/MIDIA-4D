-- =================================================================================
-- SISTEMA DE COBERTURAS E JUSTIFICATIVAS DE ESCALA MÍDIA 4D (V2 COM XP)
-- =================================================================================

-- 1. Garante que a coluna justificativa existe na tabela
DO $$ BEGIN
    IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='escala_equipe' and column_name='justificativa') THEN
        ALTER TABLE public.escala_equipe ADD COLUMN justificativa TEXT;
    END IF;
END $$;

-- 2. SECURE RPC: Função para o Voluntário Cancelar sua Escala e Abrir a Vaga
CREATE OR REPLACE FUNCTION public.cancelar_escala_vaga(
    p_escala_equipe_id UUID, 
    p_justificativa TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_escala_id UUID;
    v_funcao TEXT;
    v_departamento_id UUID;
    v_orientacao TEXT;
    v_membro_id UUID;
BEGIN
    v_membro_id := auth.uid();
    IF v_membro_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT escala_id, funcao, departamento_id, orientacao
    INTO v_escala_id, v_funcao, v_departamento_id, v_orientacao
    FROM public.escala_equipe
    WHERE id = p_escala_equipe_id AND membro_id = v_membro_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot de escala não encontrado ou não pertence a você.';
    END IF;

    -- 1) Marca o Slot Histórico do Voluntário Desistente
    UPDATE public.escala_equipe
    SET status = 'recusado', justificativa = p_justificativa
    WHERE id = p_escala_equipe_id;

    -- 2) Cria a NOVA CADEIRA VAZIA (Vaga Aberta)
    INSERT INTO public.escala_equipe (
        escala_id, funcao, membro_id, departamento_id, orientacao, status
    ) VALUES (
        v_escala_id, v_funcao, NULL, v_departamento_id, v_orientacao, 'pendente'
    );

    RETURN TRUE;
END;
$$;

-- 3. SECURE RPC: Função para um Voluntário Assumir a Vaga Aberta (+30XP Bônus Bônus)
CREATE OR REPLACE FUNCTION public.assumir_vaga_escala(
    p_escala_equipe_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_membro_id UUID;
    v_slot_dono UUID;
BEGIN
    v_membro_id := auth.uid();
    IF v_membro_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT membro_id INTO v_slot_dono FROM public.escala_equipe WHERE id = p_escala_equipe_id;

    IF v_slot_dono IS NOT NULL THEN
        RAISE EXCEPTION 'Esta vaga já foi preenchida por outro voluntário mais rápido!';
    END IF;

    -- 1. Assume a Vaga Confirmado
    UPDATE public.escala_equipe
    SET membro_id = v_membro_id, status = 'confirmado', justificativa = 'Assumiu como Cobertura!'
    WHERE id = p_escala_equipe_id;

    -- 2. Dá os 30XP Bônus pro Herói Instantaneamente!
    UPDATE public.profiles
    SET xp = COALESCE(xp, 0) + 30
    WHERE id = v_membro_id;

    -- 3. Solta Notificação do Bônus pra ele (Opcional)
    INSERT INTO public.notificacoes (membro_id, titulo, mensagem, tipo)
    VALUES (v_membro_id, 'Herói da Cobertura!', 'Você ganhou +30 XP de Bônus por ter se voluntariado na cobertura livre desta escala. Muito obrigado!', 'conquista');

    RETURN TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
