-- Verificar se esse perfil tem igreja_id vinculada
SELECT p.id, p.nome, p.role, p.igreja_id, i.nome as nome_igreja, i.codigo_convite
FROM public.profiles p
LEFT JOIN public.igrejas i ON i.id = p.igreja_id
WHERE p.id = (
    SELECT id FROM auth.users WHERE email = 'ieqceuazulpatos@gmial.com'
);

-- Ver todas as igrejas existentes no banco (para pegar o ID correto)
SELECT id, nome, codigo_convite FROM public.igrejas LIMIT 10;
