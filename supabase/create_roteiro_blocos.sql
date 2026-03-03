-- Tabela de Blocos do Roteiro (Direção de Culto)
CREATE TABLE IF NOT EXISTS public.roteiro_blocos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    titulo TEXT NOT NULL,
    descricao TEXT,
    duracao_estimada TEXT, -- Ex: "15 min",
    tipo TEXT NOT NULL DEFAULT 'comum', -- 'louvor', 'palavra', 'aviso', 'video', 'comum'
    ordem INTEGER NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'ao_vivo', 'concluido'
    
    -- Se vinculássemos a uma escala_id seria o ideal para múltiplos cultos,
    -- mas para simplificar o MVP (como o impacto), podemos deixar global
    escala_id UUID REFERENCES public.escalas(id) ON DELETE SET NULL
);

-- Habilitar RLS
ALTER TABLE public.roteiro_blocos ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Todos podem ler blocos do roteiro" ON public.roteiro_blocos;
CREATE POLICY "Todos podem ler blocos do roteiro" 
ON public.roteiro_blocos FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Apenas admins podem inserir blocos do roteiro" ON public.roteiro_blocos;
CREATE POLICY "Apenas admins podem inserir blocos do roteiro" 
ON public.roteiro_blocos FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Apenas admins podem atualizar blocos do roteiro" ON public.roteiro_blocos;
CREATE POLICY "Apenas admins podem atualizar blocos do roteiro" 
ON public.roteiro_blocos FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Apenas admins podem deletar blocos do roteiro" ON public.roteiro_blocos;
CREATE POLICY "Apenas admins podem deletar blocos do roteiro" 
ON public.roteiro_blocos FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Liga o Realtime para o roteiro_blocos
ALTER PUBLICATION supabase_realtime ADD TABLE public.roteiro_blocos;
