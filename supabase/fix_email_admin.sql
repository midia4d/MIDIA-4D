-- ==============================================================
-- ACADEMIA MÍDIA 4D - FORÇA BRUTA POR E-MAIL
-- Script para garantir Admin para: ieqceuazulpatos@gmail.com
-- ==============================================================

-- 1. Força a criação da coluna caso falte
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='role') THEN
      ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'voluntario';
  END IF;
END $$;

-- 2. Atualiza a patente e a Igreja EXATAMENTE do usuário especificado:
UPDATE public.profiles
SET role = 'admin',
    igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at ASC LIMIT 1) -- Garante que ele é dono da 1ª Igreja
WHERE id = (SELECT id FROM auth.users WHERE email = 'ieqceuazulpatos@gmail.com');

NOTIFY pgrst, 'reload schema';
