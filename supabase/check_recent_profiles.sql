SELECT p.id, p.nome, p.role, p.igreja_id, i.nome as nome_igreja
FROM public.profiles p
LEFT JOIN public.igrejas i ON p.igreja_id = i.id
ORDER BY p.created_at DESC
LIMIT 5;
