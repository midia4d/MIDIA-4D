-- Banco de Dados: MÍDIA 4D - Schema Inicial
-- Rodar este script no SQL Editor do Supabase ou via CLI.

-- Extensão necessária para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Perfis (Vinculada à tabela auth.users nativa do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    funcao_principal TEXT,
    nivel TEXT DEFAULT 'Bronze',
    xp INTEGER DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security para Perfis
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfis são visíveis publicamente." ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Usuários podem criar/editar o próprio perfil." ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- 2. Tabela de Escalas (Cultos e Eventos)
CREATE TABLE IF NOT EXISTS public.escalas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'agendado', -- 'agendado', 'concluido', 'cancelado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escalas são visíveis para todos os autenticados" ON public.escalas
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Apenas líderes/admins podem criar ou editar escalas" ON public.escalas
    FOR ALL USING (auth.role() = 'authenticated'); -- Simplificado, idealmente requeriria 'role' == 'admin'

-- 3. Tabela de Escalas_Membros (Alocação de Funções no Culto)
CREATE TABLE IF NOT EXISTS public.escala_membros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escala_id UUID NOT NULL REFERENCES public.escalas(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Pode ser NULL se a vaga não foi preenchida ainda
    funcao TEXT NOT NULL,
    confirmado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(escala_id, membro_id, funcao) -- Impede que a pessoa seja escalada duas vezes na mesma função no mesmo culto
);

ALTER TABLE public.escala_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos podem ver os membros escalados" ON public.escala_membros
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários confirmam/desmarcam a própria presença" ON public.escala_membros
    FOR UPDATE USING (auth.uid() = membro_id);
CREATE POLICY "Líderes inserem alocação" ON public.escala_membros
    FOR INSERT WITH CHECK (auth.role() = 'authenticated'); -- Simplificado temporariamente
CREATE POLICY "Líderes deletam alocação" ON public.escala_membros
    FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Função Automática para gerar o Perfil quando um usuário Cadastrar no Auth do Supabase (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger atrelado ao Auth do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
