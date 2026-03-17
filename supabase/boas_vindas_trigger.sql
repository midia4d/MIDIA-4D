-- ==========================================
-- TRIGGER DE CRIAÇÃO DE USUÁRIO COM BÔNUS DE ABERTURA
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Cria o Perfil Base com 0 XP Inicial
  INSERT INTO public.profiles (id, nome, role, xp)
  VALUES (
    new.id, 
    COALESCE(
      (new.raw_user_meta_data->>'full_name'), 
      (new.raw_user_meta_data->>'nome'), 
      'Novo Operador'
    ),
    'voluntario',
    0
  );

  -- 2. Dispara uma Notificação PUSH Básica (Sem bônus)
  INSERT INTO public.notificacoes (membro_id, titulo, mensagem, tipo, lida)
  VALUES (
    new.id,
    'Sua conta foi criada no Mídia 4D! 🎬',
    'Fale com seu líder ou coordenador para receber o link de convite e se vincular na sua Igreja!',
    'sistema',
    false
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon, service_role, postgres;
