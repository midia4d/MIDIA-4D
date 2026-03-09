-- =========================================================================
-- CORREÇÃO DEFINITIVA DO TRIGGER DAS NOTIFICAÇÕES (CRIAÇÃO DE ESCALA)
-- =========================================================================

-- 1. Cria ou Substitui a Função que injeta a Notificação
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

    -- Cria a Notificação
    INSERT INTO public.notificacoes (
        membro_id, 
        igreja_id,
        titulo, 
        mensagem, 
        tipo, 
        link
    ) VALUES (
        NEW.membro_id,
        NEW.igreja_id,
        'Você foi escalado! 📅',
        'Você tem uma nova escala confirmada no ' || COALESCE(v_titulo_culto, 'Evento') || ' para a função: ' || COALESCE(v_nome_departamento, 'Equipe') || '. Verifique as orientações no seu painel.',
        'escala',
        '/escalas'
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback de segurança para não quebrar a aplicação caso a notificação falhe
    RAISE WARNING 'Falha ao criar notificação: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Limpa o gatilho velho e problemático (se existir)
DROP TRIGGER IF EXISTS na_escala_criada_notifica ON public.escala_equipe;

-- 3. Instala o gatilho novo escutando TODA (INSERT) escala configurada pelo Líder
CREATE TRIGGER na_escala_criada_notifica
    AFTER INSERT ON public.escala_equipe
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_nova_escala_notificacao();

-- 4. Notificando a Cache da API Rest pra enxergar o Trigger novo
NOTIFY pgrst, 'reload schema';
