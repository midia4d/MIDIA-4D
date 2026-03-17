-- ==============================================================
-- ROTEIRO 2.0: STATUS DE DEPARTAMENTOS E CRONOMETRIA
-- ==============================================================

-- 1. Tabela para Prontidão Manual dos Departamentos
CREATE TABLE IF NOT EXISTS public.roteiro_status_departamentos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE,
    departamento TEXT NOT NULL, -- 'cameras', 'luz', 'som', 'transmissao'
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'pronto'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    UNIQUE(igreja_id, departamento)
);

-- 2. Garantir Multi-tenant nas tabelas de Checklist (Se ainda não tiver)
ALTER TABLE public.checklist_departamentos ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_itens ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_submissoes ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;

-- 3. Adicionar coluna de controle de tempo no Roteiro
ALTER TABLE public.roteiro_blocos ADD COLUMN IF NOT EXISTS ao_vivo_desde TIMESTAMP WITH TIME ZONE;

-- 4. Habilitar RLS para Status
ALTER TABLE public.roteiro_status_departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de status por igreja" ON public.roteiro_status_departamentos;
CREATE POLICY "Leitura de status por igreja" 
ON public.roteiro_status_departamentos FOR SELECT 
USING (igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Escrita de status por membros" ON public.roteiro_status_departamentos;
CREATE POLICY "Escrita de status por membros" 
ON public.roteiro_status_departamentos FOR ALL 
TO authenticated
USING (igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (igreja_id = (SELECT igreja_id FROM profiles WHERE id = auth.uid()));

-- 5. Ativar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.roteiro_status_departamentos;

NOTIFY pgrst, 'reload schema';
