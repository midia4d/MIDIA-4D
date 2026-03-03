-- ==========================================
-- ACADEMIA MÍDIA 4D - E-Learning Volunteers
-- ==========================================

-- 1. Criação da Tabela de Treinamentos e Materiais
CREATE TABLE IF NOT EXISTS public.treinamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT NOT NULL DEFAULT 'Geral', -- Ex: Câmera, ProPresenter, Comportamento
    video_url TEXT, -- Link do Youtube ou similar
    pdf_url TEXT, -- Link para documento de material de apoio
    ordem INTEGER DEFAULT 0, -- Para o Admin ordenar a trilha de ensino
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Segurança de Linha (RLS - Row Level Security)
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;

-- Permissão 1: Voluntários podem LER os treinamentos (Acesso à Academia)
CREATE POLICY "Voluntários podem ver os treinamentos"
    ON public.treinamentos
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permissão 2: APENAS Administradores podem INSERIR/CRIAR novos treinamentos
CREATE POLICY "Admins podem criar treinamentos"
    ON public.treinamentos
    FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Permissão 3: APENAS Administradores podem EDITAR os treinamentos
CREATE POLICY "Admins podem editar treinamentos"
    ON public.treinamentos
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Permissão 4: APENAS Administradores podem DELETAR os treinamentos
CREATE POLICY "Admins podem deletar treinamentos"
    ON public.treinamentos
    FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Notifica o PostgREST para reconhecer a nova Schema
NOTIFY pgrst, 'reload schema';
