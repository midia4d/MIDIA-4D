-- 1. Tabela de Escalas
CREATE TABLE IF NOT EXISTS public.escalas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    data_horario TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id)
);

-- 2. Tabela de Equipe da Escala
CREATE TABLE IF NOT EXISTS public.escala_equipe (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    escala_id UUID REFERENCES public.escalas(id) ON DELETE CASCADE NOT NULL,
    funcao TEXT NOT NULL,
    membro_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'recusado'))
);

-- 3. Habilitar Segurança (RLS)
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_equipe ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para Escalas
-- Todos podem ver as escalas
CREATE POLICY "Escalas visíveis para todos" ON public.escalas FOR SELECT USING (true);
-- Apenas admins podem modificar escalas
CREATE POLICY "Apenas admins criam escalas" ON public.escalas FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
CREATE POLICY "Apenas admins editam escalas" ON public.escalas FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
CREATE POLICY "Apenas admins deletam escalas" ON public.escalas FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Acesso Admin para alterar a equipe
CREATE POLICY "Admins gerenciam membros da escala" ON public.escala_equipe USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
-- Voluntário pode alterar O SEU PRÓPRIO status (confirmado/recusado)
CREATE POLICY "Voluntários podem confirmar presença" ON public.escala_equipe FOR UPDATE USING (
    auth.uid() = membro_id
) WITH CHECK (
    auth.uid() = membro_id
);
