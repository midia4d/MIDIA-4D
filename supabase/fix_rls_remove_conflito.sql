-- ====================================================
-- FIX DEFINITIVO: Remover política problemática com get_minha_igreja()
-- ====================================================

-- Remove a política que usa get_minha_igreja() (causa recursão ou falha no contexto de produção)
DROP POLICY IF EXISTS "Ver próprio perfil ou da mesma igreja" ON public.profiles;

-- Confirma que as 2 políticas simples e seguras continuam existindo
-- (Foram criadas pelo fix_rls_profiles_select.sql)
-- "Usuário lê próprio perfil" -> auth.uid() = id
-- "Membros veem perfis da mesma igreja" -> auth.uid() = id OR mesma igreja (via subquery)

-- Verificar resultado final:
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles' ORDER BY cmd;
