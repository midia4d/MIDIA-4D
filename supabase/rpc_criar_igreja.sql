-- ==============================================================
-- ACADEMIA MÍDIA 4D - ATÔMICO WORKSPACE CREATION
-- Função RPC Segura para criar a igreja e já setar Admin
-- ==============================================================

CREATE OR REPLACE FUNCTION public.criar_nova_igreja(nome_igreja TEXT, codigo TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Super poderes para ignorar RLS e evitar falha silenciosa de Update no React
AS $$
DECLARE
    v_igreja_id UUID;
BEGIN
    -- 1. Cria a Igreja e pega o ID dela
    INSERT INTO public.igrejas (nome, codigo_convite, admin_id)
    VALUES (nome_igreja, codigo, auth.uid())
    RETURNING id INTO v_igreja_id;

    -- 2. Atualiza o Perfil na hora, dando o poder de Admin e vinculando a Igreja
    UPDATE public.profiles
    SET igreja_id = v_igreja_id,
        role = 'admin'
    WHERE id = auth.uid();

    -- Retorna o ID pro React se precisar
    RETURN v_igreja_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
