-- ===========================================
-- FIX URGENTE: RLS Políticas da Tabela Profiles
-- Erro: "permission denied for table profiles" (42501)
-- ===========================================

-- Garante que usuários autenticados conseguem ler o próprio perfil
-- (Essencial para o fluxo de Login verificar o igreja_id)

-- Remover políticas antigas conflitantes (se existirem)
DROP POLICY IF EXISTS "Usuário lê próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Voluntários veem perfis da mesma igreja" ON public.profiles;
DROP POLICY IF EXISTS "Membros veem perfis da igreja" ON public.profiles;

-- Política 1: Usuário lê o PRÓPRIO perfil (base mínima para o Login funcionar)
CREATE POLICY "Usuário lê próprio perfil"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Política 2: Usuário lê perfis de quem é da mesma Igreja (para Ranking, Escalas, etc)
CREATE POLICY "Membros veem perfis da mesma igreja"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id  -- sempre pode ver o próprio
    OR
    igreja_id IN (
        SELECT p.igreja_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

NOTIFY pgrst, 'reload schema';
