-- ====================================================
-- DIAGNÓSTICO + LIMPEZA TOTAL DAS POLÍTICAS DE PROFILES
-- ====================================================

-- PASSO 1: Ver TODAS as políticas existentes na tabela profiles
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
