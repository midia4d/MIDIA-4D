-- =======================================================
-- ACADEMIA MÍDIA 4D - SCRIPT DE PRIVILÉGIOS DE SUPER ADMIN (DONO DA APLICAÇÃO) - FIX RECURSÃO INFINTA
-- =======================================================

-- 1. Cria a coluna is_super_admin no Perfil (Geralmente marcada manualmente via Painel Supabase original)
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='is_super_admin') THEN
      ALTER TABLE public.profiles ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='igrejas' and column_name='status_assinatura') THEN
      ALTER TABLE public.igrejas ADD COLUMN status_assinatura TEXT DEFAULT 'ativa' CHECK (status_assinatura IN ('ativa', 'suspensa', 'cancelada'));
  END IF;
END $$;

-- 2. FUNÇÃO HELPER PARA EVITAR RECURSÃO INFINITA
-- Em vez de fazer JOIN na própria tabela profiles (oque gera loop), criamos uma função Security Definer rápida
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Retorna true/false lendo direto sem passar por validação de policy aninhada
  SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1), false);
$$;

-- 3. RECRIAR AS POLÍTICAS USANDO A FUNÇÃO HELPER SEGURA

-- Limpar as quebradas que geraram o erro pro Pastor:
DROP POLICY IF EXISTS "Super Admins gerenciam todas as igrejas" ON public.igrejas;
DROP POLICY IF EXISTS "Super Admins leem todos os perfis globais" ON public.profiles;

-- Super Admins podem LER e ATUALIZAR absolutamente todas as igrejas do sistema!
CREATE POLICY "Super Admins gerenciam todas as igrejas" 
ON public.igrejas 
FOR ALL 
USING (public.check_is_super_admin());

-- Super Admins podem LER todos os perfis para gerar métricas e usuários totais
CREATE POLICY "Super Admins leem todos os perfis globais" 
ON public.profiles 
FOR SELECT 
USING (public.check_is_super_admin());

NOTIFY pgrst, 'reload schema';
