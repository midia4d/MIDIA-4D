-- =======================================================
-- ACADEMIA MÍDIA 4D - SCRIPT DE PRIVILÉGIOS DE SUPER ADMIN (DONO DA APLICAÇÃO)
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

-- 2. Elevar as permissões RLS da Tabela Igrejas
-- Super Admins podem LER e ATUALIZAR absolutamente todas as igrejas do sistema!
CREATE POLICY "Super Admins gerenciam todas as igrejas" 
ON public.igrejas 
FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

-- Super Admins podem LER todos os perfis para gerar métricas e usuários totais
CREATE POLICY "Super Admins leem todos os perfis globais" 
ON public.profiles 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

NOTIFY pgrst, 'reload schema';
