-- ==========================================
-- ACADEMIA MÍDIA 4D - ATUALIZAÇÃO V2
-- Modulos, Aulas, Progresso e Avaliações
-- ==========================================

-- 1. Nova Tabela de Categorias/Módulos Pai
CREATE TABLE IF NOT EXISTS public.treinamento_modulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    capa_url TEXT, -- Link da imagem de capa opcional
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS no Módulo
ALTER TABLE public.treinamento_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voluntários podem ver os modulos" ON public.treinamento_modulos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins c/e/d modulos" ON public.treinamento_modulos FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Atualização da tabela de treinamentos (Aulas Filhas)
-- Para não quebrar o que ele já criou agora, vamos apenas adicionar a chave estrangeira caso não exista
DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='treinamentos' and column_name='modulo_id') THEN
      ALTER TABLE public.treinamentos ADD COLUMN modulo_id UUID REFERENCES public.treinamento_modulos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Tabela de Progresso e Avaliação (O Voluntário e sua relação com o Vídeo)
CREATE TABLE IF NOT EXISTS public.treinamentos_progresso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membro_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    treinamento_id UUID NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
    concluido BOOLEAN DEFAULT false,
    avaliacao INTEGER CHECK (avaliacao >= 1 AND avaliacao <= 5), -- 1 a 5 estrelas
    data_conclusao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(membro_id, treinamento_id) -- Uma pessoa só tem 1 progresso por aula
);

-- Habilitar RLS no Progresso
ALTER TABLE public.treinamentos_progresso ENABLE ROW LEVEL SECURITY;
-- Voluntário só vê, insere e altera o seu próprio progresso
CREATE POLICY "Usuários veem próprio progresso" ON public.treinamentos_progresso FOR SELECT USING (auth.uid() = membro_id);
CREATE POLICY "Usuários criam próprio progresso" ON public.treinamentos_progresso FOR INSERT WITH CHECK (auth.uid() = membro_id);
CREATE POLICY "Usuários atualizam próprio progresso" ON public.treinamentos_progresso FOR UPDATE USING (auth.uid() = membro_id);

-- Notifica o PostgREST para reconhecer a nova Schema
NOTIFY pgrst, 'reload schema';
