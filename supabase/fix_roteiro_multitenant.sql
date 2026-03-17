-- ==============================================================
-- BUGFIX: ROTEIRO MULTI-TENANT (MÍDIA 4D)
-- Corrigindo o nome da tabela e habilitando RLS por Igreja
-- ==============================================================

-- 1. Garante que a coluna igreja_id existe na tabela correta
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roteiro_blocos') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='roteiro_blocos' and column_name='igreja_id') THEN
          ALTER TABLE public.roteiro_blocos ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;
END $$;

-- 2. Habilitar RLS
ALTER TABLE public.roteiro_blocos ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso Isoladas por Igreja
DROP POLICY IF EXISTS "Todos podem ler blocos do roteiro" ON public.roteiro_blocos;
DROP POLICY IF EXISTS "Apenas admins podem inserir blocos do roteiro" ON public.roteiro_blocos;
DROP POLICY IF EXISTS "Apenas admins podem atualizar blocos do roteiro" ON public.roteiro_blocos;
DROP POLICY IF EXISTS "Apenas admins podem deletar blocos do roteiro" ON public.roteiro_blocos;
DROP POLICY IF EXISTS "Acesso total para autenticados em blocos" ON public.roteiro_blocos;

-- Leitura: Apenas membros da mesma igreja
CREATE POLICY "Leitura por igreja" 
ON public.roteiro_blocos FOR SELECT 
USING (igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid()));

-- Inserção: Apenas Admins da mesma igreja
CREATE POLICY "Inserção por igreja admin" 
ON public.roteiro_blocos FOR INSERT 
WITH CHECK (
  igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Atualização: Apenas Admins da mesma igreja
CREATE POLICY "Atualização por igreja admin" 
ON public.roteiro_blocos FOR UPDATE 
USING (
  igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Deleção: Apenas Admins da mesma igreja
CREATE POLICY "Deleção por igreja admin" 
ON public.roteiro_blocos FOR DELETE 
USING (
  igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  AND 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Garante que o Realtime está ativo para a tabela correta
-- Primeiro remove se existir em alguma publicação para evitar duplicatas (opcional mas seguro)
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.roteiro_blocos;
-- Adiciona na publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.roteiro_blocos;

NOTIFY pgrst, 'reload schema';
