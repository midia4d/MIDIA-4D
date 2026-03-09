-- =========================================================================
-- SUPER-PATCH FINAL: CORREÇÃO COMPLETA DE NOTIFICAÇÕES (PUSH AUTOMÁTICO)
-- Versão Simplificada (Sem Multi-Tenant / Tabelas de Igrejas)
-- Copie este código inteiro e cole no SQL Editor do Supabase, depois aperte RUN.
-- =========================================================================

-- 1. Corrige o Conflito de Nomes: A Tabela foi criada com "usuario_id", mas o App procura "membro_id"
DO $$ 
BEGIN
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='notificacoes' and column_name='usuario_id') THEN
        ALTER TABLE public.notificacoes RENAME COLUMN usuario_id TO membro_id;
    END IF;
END $$;

-- 2. Garante que as Notificações podem trafegar na Internet (WebSockets Realtime)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
EXCEPTION WHEN duplicate_object THEN
  -- Ignora silenciosamente
END;
$$;

ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;

-- 3. Limpa e Reescreve a Segurança RLS pra NADA barrar a Inserção do Robô e Leitura do Usuário
ALTER TABLE public.notificacoes DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membro ve suas proprias notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Admin dispara notificacoes para a igreja" ON public.notificacoes;
DROP POLICY IF EXISTS "Sistema insere notificacoes (triggers)" ON public.notificacoes;
DROP POLICY IF EXISTS "Membro marca como lida" ON public.notificacoes;
DROP POLICY IF EXISTS "Inserção livre de notificações" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON public.notificacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar suas notificações" ON public.notificacoes;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membro ve suas proprias notificacoes" ON public.notificacoes FOR SELECT USING (membro_id = auth.uid());
CREATE POLICY "Inserção livre de notificações" ON public.notificacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Membro marca como lida" ON public.notificacoes FOR UPDATE USING (membro_id = auth.uid());


-- 4. Reconstrói o "Robô Gatilho" que escuta a Escala e insere o texto na Tabela de Notificações
CREATE OR REPLACE FUNCTION public.handle_nova_escala_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_titulo_culto TEXT;
    v_nome_departamento TEXT;
BEGIN
    -- Se a escala não estiver pendente, ignoramos (não notifica no check-in)
    IF NEW.status != 'pendente' THEN
        RETURN NEW;
    END IF;

    -- Pega o nome do Culto
    SELECT titulo INTO v_titulo_culto FROM public.escalas WHERE id = NEW.escala_id;
    
    -- Pega o nome do Departamento (se existir)
    IF NEW.departamento_id IS NOT NULL THEN
        SELECT nome INTO v_nome_departamento FROM public.checklist_departamentos WHERE id = NEW.departamento_id;
    ELSE
        v_nome_departamento := 'Mídia 4D';
    END IF;

    -- Cria a Notificação Mágica apontando pra quem foi escalado
    INSERT INTO public.notificacoes (
        membro_id, 
        titulo, 
        mensagem, 
        tipo, 
        link
    ) VALUES (
        NEW.membro_id,
        'Você foi escalado! 📅',
        'Você tem uma nova escala confirmada no ' || COALESCE(v_titulo_culto, 'Evento') || ' para a função: ' || COALESCE(v_nome_departamento, 'Equipe') || '. Verifique as orientações no seu painel.',
        'escala',
        '/escalas'
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao criar notificação: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 5. Instala o Robô de novo e manda ele trabalhar
DROP TRIGGER IF EXISTS na_escala_criada_notifica ON public.escala_equipe;
CREATE TRIGGER na_escala_criada_notifica
    AFTER INSERT ON public.escala_equipe
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_nova_escala_notificacao();

-- 6. Manda as APIs acordarem
NOTIFY pgrst, 'reload schema';
