-- =======================================================
-- ACADEMIA MÍDIA 4D - RPC DE CONCLUSÃO DE TREINAMENTO + XP
-- =======================================================
-- Função segura atômica que processa a Gamificação.
-- Quando o voluntário clica em "Marcar como Concluída"
-- o banco registra a aula, soma +15 XP no seu Profile 
-- e dispara uma notificação (Sininho) de reconhecimento.

CREATE OR REPLACE FUNCTION public.concluir_treinamento_com_xp(
    p_treinamento_id UUID,
    p_concluido BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_igreja_id UUID;
    v_xp_atual INTEGER;
    v_titulo_aula TEXT;
    v_xp_recompensa INTEGER := 15; -- Pontos de XP fixos por Aula
    v_ja_concluido BOOLEAN;
BEGIN
    -- 1. Capturar Usuário Logado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- 2. Capturar Igreja e XP Atual do Perfil
    SELECT igreja_id, COALESCE(xp, 0) INTO v_igreja_id, v_xp_atual 
    FROM public.profiles 
    WHERE id = v_user_id;

    -- 3. Capturar Título da Aula para a Notificação
    SELECT titulo INTO v_titulo_aula 
    FROM public.treinamentos 
    WHERE id = p_treinamento_id;

    -- 4. Verificar se ele já havia concluído antes (Anti-Exploit de XP Finito)
    -- Só dá o XP na PRIMEIRA vez que concluir
    SELECT concluido INTO v_ja_concluido
    FROM public.treinamentos_progresso
    WHERE membro_id = v_user_id AND treinamento_id = p_treinamento_id;

    -- 5. Gravar/Atualizar a marcação de Aula Concluída
    INSERT INTO public.treinamentos_progresso (membro_id, treinamento_id, concluido, data_conclusao)
    VALUES (v_user_id, p_treinamento_id, p_concluido, NOW())
    ON CONFLICT (membro_id, treinamento_id) 
    DO UPDATE SET 
        concluido = p_concluido,
        data_conclusao = CASE WHEN p_concluido = true THEN NOW() ELSE NULL END;

    -- 6. Injeção de XP Gamificado e Notificação Exclusiva (Se ele concluiu pela PRIMEIRA vez hoje)
    IF p_concluido = true AND (v_ja_concluido IS NULL OR v_ja_concluido = false) THEN
        
        -- Adicionar +15 XP
        UPDATE public.profiles 
        SET xp = v_xp_atual + v_xp_recompensa
        WHERE id = v_user_id;

        -- Disparar Sininho Triunfal!
        INSERT INTO public.notificacoes (membro_id, igreja_id, titulo, mensagem, tipo, link_url)
        VALUES (
            v_user_id,
            v_igreja_id,
            'Estudioso! +15 XP ✨',
            'Você concluiu a aula "' || v_titulo_aula || '" e ganhou experiência bônus.',
            'conquista',
            '/academia'
        );
        
        RETURN json_build_object('status', 'sucesso_xp', 'xp_adicionado', v_xp_recompensa);
    END IF;

    -- Se ele apenas desmarcou a aula ou já havia feito antes
    RETURN json_build_object('status', 'sucesso_apenas_status');

END;
$$;

NOTIFY pgrst, 'reload schema';
