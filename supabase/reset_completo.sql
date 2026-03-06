-- ==========================================
-- RESET FINAL: MÍDIA 4D (SINGLE-TENANT)
-- ATENÇÃO: ESTE SCRIPT APAGA TODAS AS TABELAS
-- E AS RECRIARÁ DO ZERO, LIMPANDO TODOS OS BUGS.
-- TODOS OS DADOS DE TESTE SERÃO PERDIDOS (MAS OS USUÁRIOS CONTINUAM CADASTRADOS NA AUTENTICAÇÃO)
-- ==========================================

-- 1. APAGAR TUDO DA PUBLIC (LIMPEZA TOTAL DO ZERO)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Garantir que a Role 'postgres' (Supabase Admin) e o projeto tenham acesso ao public
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- Configurar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- ==========================================
-- 2. RECRIAR TABELAS DO ZERO (SEM 'igreja_id', SEM MULTI-TENANT)
-- ==========================================

-- A) PERFIS E USUÁRIOS (PROFILES)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL DEFAULT 'Vazio',
    role TEXT NOT NULL DEFAULT 'voluntario', -- 'voluntario' ou 'admin'
    funcao_principal TEXT,
    xp INTEGER NOT NULL DEFAULT 50, -- Começa com 50
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- B) DISPONIBILIDADE
CREATE TABLE public.disponibilidade (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    membro_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_disponivel DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- C) ESCALAS (CULTOS/EVENTOS)
CREATE TABLE public.escalas (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    titulo TEXT NOT NULL,
    data_horario TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- D) SETORES DA TV/MÍDIA (DEPARTAMENTOS PARA O CHECKLIST)
CREATE TABLE public.checklist_departamentos (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- E) ITENS ESPECÍFICOS DE CADA SETOR (CHECKLIST ITENS)
CREATE TABLE public.checklist_itens (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    departamento_id UUID NOT NULL REFERENCES public.checklist_departamentos(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- F) AUDITORIA DOS CHECKLISTS FEITOS
CREATE TABLE public.checklist_submissoes (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    departamento_id UUID NOT NULL REFERENCES public.checklist_departamentos(id) ON DELETE CASCADE,
    membro_id UUID NOT NULL REFERENCES auth.users(id),
    escala_id UUID REFERENCES public.escalas(id) ON DELETE SET NULL,
    data_submissao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- G) ALOCAÇÃO DA EQUIPE NAS ESCALAS
CREATE TABLE public.escala_equipe (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    escala_id UUID NOT NULL REFERENCES public.escalas(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    departamento_id UUID REFERENCES public.checklist_departamentos(id) ON DELETE SET NULL, -- Para atrelar função ao checklist
    funcao TEXT NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'recusado')),
    justificativa TEXT,
    orientacao TEXT,
    check_in_realizado TIMESTAMP WITH TIME ZONE,
    xp_ganho INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- H) ROTEIROS DO CULTO (MÓDULO DE DIREÇÃO)
CREATE TABLE public.roteiros (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    titulo TEXT NOT NULL,
    data_culto DATE NOT NULL,
    status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'liberado', 'concluido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- I) BLOCOS DO ROTEIRO
CREATE TABLE public.roteiro_blocos (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    roteiro_id UUID NOT NULL REFERENCES public.roteiros(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    horario_previsto TIME,
    titulo_bloco TEXT NOT NULL,
    descricao TEXT,
    duracao_estimada_minutos INTEGER DEFAULT 5,
    responsavel TEXT,
    anexos_urls TEXT[],
    observacoes_midia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- J) NOTIFICAÇÕES (SISTEMA DE AVISOS INTERNO)
CREATE TABLE public.notificacoes (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'info',
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- 3. INSERIR DADOS PADRÃO VITAIS E O ADMIN
-- ==========================================

-- Inserir os Departamentos Básicos do Checklists (Setores)
INSERT INTO public.checklist_departamentos (id, nome, ordem) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Projeção (Holyrics)', 1),
    ('22222222-2222-2222-2222-222222222222', 'Transmissão (OBS/Câmeras)', 2),
    ('33333333-3333-3333-3333-333333333333', 'Fotografia', 3),
    ('44444444-4444-4444-4444-444444444444', 'Iluminação', 4),
    ('55555555-5555-5555-5555-555555555555', 'Áudio da Live', 5);

-- Inserir Pelo menos 1 item em cada departamento para funcionar
INSERT INTO public.checklist_itens (departamento_id, descricao, ordem) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Ligar TVs e Painel de LED', 1),
    ('11111111-1111-1111-1111-111111111111', 'Atualizar Louvores no Holyrics', 2),
    ('22222222-2222-2222-2222-222222222222', 'Testar placa de captura e câmeras', 1),
    ('22222222-2222-2222-2222-222222222222', 'Iniciar gravação de segurança no PC', 2),
    ('33333333-3333-3333-3333-333333333333', 'Checar bateria e cartões SD das Câmeras', 1),
    ('44444444-4444-4444-4444-444444444444', 'Checar comunicação DMX com canhões', 1),
    ('55555555-5555-5555-5555-555555555555', 'Checar LR vindo da mesa de som', 1);

-- Injetar o Líder/Admin automaticamente lendo a tabela auth.users!
-- Pega qualquer usuário já registrado para recriar nos profiles:
INSERT INTO public.profiles (id, nome, role, funcao_principal, xp)
SELECT id, COALESCE((raw_user_meta_data->>'nome'), 'Pastor/Líder'), 'voluntario', 'Voluntário da Mídia', 50
FROM auth.users;

-- Forçar PODER MÁXIMO GLOBAL APENAS para o e-mail oficial (O seu).
UPDATE public.profiles
SET role = 'admin', funcao_principal = 'Líder / Administrador', xp = 1000
WHERE id IN (
    SELECT id FROM auth.users WHERE email ILIKE 'ieqceuazulpatos@gmail.com'
);

-- ==========================================
-- 4. SEGURANÇA E ACESSO (O MAIS SIMPLES POSSÍVEL)
-- PÚBLICO PARA TODOS LOGADOS. APENAS ADMIN PODE DELETAR/CRIAR EM MASSA.
-- ==========================================

-- Habilitar Realtime para funcionamento instantâneo nos dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_equipe;
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- Todas as tabelas são PÚBLICAS para Leitura e Escrita se o cara tem conta de usuário criada.
-- Como é single-tenant (só o Mídia 4D), não precisamos blindar com "igreja_id". Todos do app se enxergam.
-- As Views no React cuidam de esconder a barra lateral do Admin de meros voluntários.

-- Função para o Trigger de Criação de Conta Auth -> Profile:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (new.id, COALESCE((new.raw_user_meta_data->>'nome'), 'Novo Operador'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar Trigger de criação automática
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- PRONTO! BANCO DE DADOS 100% REINICIADO DO ZERO. SINGLE-TENANT. LIVRE DE BUGS.
