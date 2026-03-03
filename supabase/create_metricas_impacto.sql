-- Criação da tabela para armazenar os números do painel de Impacto
CREATE TABLE IF NOT EXISTS public.metricas_impacto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mes_referencia TEXT NOT NULL, -- Ex: 'Novembro', 'Dezembro 2026'
    visualizacoes INTEGER DEFAULT 0,
    pessoas_alcancadas INTEGER DEFAULT 0,
    vidas_transformadas INTEGER DEFAULT 0,
    cortes_replicados INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.metricas_impacto ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- Qualquer voluntário autenticado pode *ler* as métricas
CREATE POLICY "Métricas Visíveis para todos os voluntários"
ON public.metricas_impacto FOR SELECT
USING (auth.uid() IN (SELECT id FROM profiles));

-- Apenas membros com role 'admin' podem *inserir* ou *atualizar* as métricas
CREATE POLICY "Apenas admins atualizam métricas"
ON public.metricas_impacto FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

-- Notifica o PostgREST para ler a nova tabela
NOTIFY pgrst, 'reload schema';
