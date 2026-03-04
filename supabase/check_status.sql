-- Consulta de diagnóstico para o terminal
SELECT p.id, p.nome, p.role, p.igreja_id, i.nome as nome_igreja, u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.igrejas i ON i.id = p.igreja_id
WHERE u.email = 'ieqceuazulpatos@gmail.com';
