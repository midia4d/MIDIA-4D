-- ==========================================
-- CORREÇÃO DA TRIGGER DE BOAS VINDAS (BUG FIX DATABASE ERROR)
-- ==========================================
-- Remover a antiga que causava concorrência no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Cria o Perfil Base com 50 XP Inicial apenas (Sem tocar em Notificações agora)
  INSERT INTO public.profiles (id, nome, role, xp)
  VALUES (
    new.id, 
    COALESCE(
      (new.raw_user_meta_data->>'full_name'), 
      (new.raw_user_meta_data->>'nome'), 
      'Novo Operador'
    ),
    'voluntario',
    50
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-aplicar a permissão
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon, service_role, postgres;

-- Ligar o gatilho novamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
