-- ==============================================================
-- ACADEMIA MÍDIA 4D - FORÇA BRUTA ADMIN
-- ==============================================================

-- 1. Força a atualização da patente baseada puramente na tabela de Igrejas
UPDATE public.profiles
SET role = 'admin',
    igreja_id = i.id
FROM public.igrejas i
WHERE public.profiles.id = i.admin_id;

-- 2. Se por acaso você for o único usuário do sistema testando agora, vira admin à força:
UPDATE public.profiles
SET role = 'admin';

NOTIFY pgrst, 'reload schema';
