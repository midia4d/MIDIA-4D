-- ==========================================
-- CORREÇÃO TRIGGER NOME DE USUÁRIO
-- Função para extrair o "nome" ou "full_name" passado via payload do frontend
-- quando o voluntário digita no cadastro, substituindo o apelido genérico.
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (
    new.id, 
    COALESCE(
      (new.raw_user_meta_data->>'full_name'), 
      (new.raw_user_meta_data->>'nome'), 
      'Novo Operador'
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Também vamos corrigir TODOS OS PERFIS atuais que caíram como "Novo Operador" ou nulos,
-- tentando ler a metadata de seus cadastros passados:

UPDATE public.profiles p
SET nome = COALESCE(
  (au.raw_user_meta_data->>'full_name'), 
  (au.raw_user_meta_data->>'nome'), 
  'Voluntário'
)
FROM auth.users au
WHERE p.id = au.id AND (p.nome = 'Novo Operador' OR p.nome = 'Vazio' OR p.nome IS NULL);

-- Garantir acesso para que a Trigger não fique cega (pós-reinício do banco)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon, service_role, postgres;
