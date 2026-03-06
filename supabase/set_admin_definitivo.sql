-- Script Master: Reverter para Instância Única e forçar Pastor Gabriel como Admin.

-- 1. Assegurar que exista uma única Igreja Master no sistema
INSERT INTO public.igrejas (nome)
VALUES ('Sistema Mídia 4D')
ON CONFLICT DO NOTHING;

-- Capturar o ID da igreja master criada (ou já existente)
DO $$
DECLARE
    mestre_igreja_id UUID;
    mestre_user_id UUID;
BEGIN
    SELECT id INTO mestre_igreja_id FROM public.igrejas ORDER BY created_at ASC LIMIT 1;
    
    -- 2. Localizar o UUID do pastor pelo email na Auth
    SELECT id INTO mestre_user_id FROM auth.users WHERE email = 'ieqceuazulpatos@gmail.com';
    
    IF mestre_user_id IS NOT NULL THEN
        -- 3. Conceder "carteirada" absoluta de admin ao Pastor e associá-lo à igreja master
        UPDATE public.profiles
        SET 
            role = 'admin',
            igreja_id = mestre_igreja_id,
            funcao_principal = 'Líder / Administrador'
        WHERE id = mestre_user_id;

        -- 4. Definir também como administrador da Igreja (dono do tenant restrito)
        UPDATE public.igrejas
        SET admin_id = mestre_user_id
        WHERE id = mestre_igreja_id;
    END IF;
    
    -- 5. Vincular todos os usuários "zumbis" ou soltos à Igreja Master por padrão
    --    Assim o app volta a ser Single-Tenant puro.
    UPDATE public.profiles
    SET igreja_id = mestre_igreja_id
    WHERE igreja_id IS NULL;
    
END $$;
