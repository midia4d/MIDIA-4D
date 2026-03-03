-- ==========================================================
-- ACADEMIA MÍDIA 4D - FUNÇÃO DE DELEÇÃO DE CONTA DE USUÁRIO
-- ==========================================================
-- O lado do cliente nunca tem permissão para dar DELETE na 
-- raiz de autenticação (auth.users) por questões de segurança.
-- Esta função abre um canal supervisionado para que o Cidadão
-- possa apagar a sua PRÓPRIA conta.

CREATE OR REPLACE FUNCTION public.deletar_minha_conta()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Captura o ID do usuário que CHAMOU a função (quem clicou no botão)
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Deletar da raiz auth.users. 
    -- Como nós já configuramos o CASCADE em todas as tabelas (profiles, escalas, checklists, etc)
    -- O PostgreSQL vai se encarregar de triturar todos os dados desse usuário em toda a base!
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
