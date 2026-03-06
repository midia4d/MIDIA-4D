-- Vincular conta do admin à Igreja IEQ e garantir role = admin
UPDATE public.profiles
SET 
    igreja_id = '3e40234f-1c4e-4321-ab5f-69a7d0fa9341',
    role = 'admin'
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'ieqceuazulpatos@gmial.com'
);

-- Confirmar
SELECT id, nome, role, igreja_id FROM public.profiles
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'ieqceuazulpatos@gmial.com'
);
