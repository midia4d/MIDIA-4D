-- Promover conta para Admin
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'ieqceuazulpatos@gmial.com'
);

-- Confirmar resultado
SELECT id, nome, role, igreja_id
FROM public.profiles
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'ieqceuazulpatos@gmial.com'
);
