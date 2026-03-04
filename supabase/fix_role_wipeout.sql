-- ==============================================================
-- ACADEMIA MÍDIA 4D - FIX WIPE DATABASE
-- Script de Correção da tabela de Perfis pós Delete All
-- ==============================================================

-- 1. Cria a coluna de "role" se ela sumiu com o wipeout
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='role') THEN
      ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'voluntario';
  END IF;
END $$;

-- 2. Torna o seu perfil recém-criado em Admin!
-- Isso garante que a conta que você já criou e está logado não seja perdida
UPDATE public.profiles
SET role = 'admin'
WHERE igreja_id IS NOT NULL; -- Pega os líderes

NOTIFY pgrst, 'reload schema';
