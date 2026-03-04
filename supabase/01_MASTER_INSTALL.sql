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
-- ==========================================
-- ACADEMIA MÍDIA 4D - MULTI-TENANT (SaaS)
-- Criação da Tabela Igrejas e Link de Perfil
-- ==========================================

-- 1. Criar a Tabela Master de Igrejas (Workspaces)
CREATE TABLE IF NOT EXISTS public.igrejas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    codigo_convite TEXT NOT NULL UNIQUE, -- Ex: IEQ1517, BPT5542
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- O cara que criou o workspace
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Segurança da Tabela de Igrejas
ALTER TABLE public.igrejas ENABLE ROW LEVEL SECURITY;

-- Todo mundo pode LER as igrejas (necessário para validar o código de convite no login)
CREATE POLICY "Leitura pública de igrejas" ON public.igrejas FOR SELECT USING (true);
-- Qualquer usuário autenticado (que acabou de criar conta e clicou em "Sou Líder") pode INSERIR sua igreja
CREATE POLICY "Criação de igrejas" ON public.igrejas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Apenas o admin dono da igreja pode editar os dados dela
CREATE POLICY "Admin atualiza sua igreja" ON public.igrejas FOR UPDATE USING (auth.uid() = admin_id);


-- ==========================================
-- 2. Atualizar a Tabela Profiles (Perfis) p/ Multi-Tenant
-- ==========================================
DO $$
BEGIN
  -- Injeta a Coluna igreja_id no Perfil (Se não existir)
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='igreja_id') THEN
      ALTER TABLE public.profiles ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE SET NULL;
  END IF;

  -- Injeta a Coluna role no Perfil (Se não existir) p/ controle de Administradores
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='role') THEN
      ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'voluntario';
  END IF;
END $$;

-- 3. Função Auxiliar para Facilitar o Frontend (Entrar na Igreja)
-- Como o RLS bloqueia Updates loucos, vamos criar uma função RPC de banco de dados
-- que permite ao Voluntário vincular-se a uma igreja se ele enviar o código correto.

CREATE OR REPLACE FUNCTION public.entrar_na_igreja(codigo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com privilégios de admin para poder dar bypass em travas Iniciais
AS $$
DECLARE
    v_igreja_id UUID;
BEGIN
    -- Busca se a igreja com aquele codigo existe
    SELECT id INTO v_igreja_id FROM public.igrejas WHERE codigo_convite = codigo LIMIT 1;
    
    -- Se não achou, retorna erro
    IF v_igreja_id IS NULL THEN
        RAISE EXCEPTION 'Código de Convite Inválido ou Igreja não existe.';
    END IF;

    -- Se achou, atualiza o Perfil daquele usuário vinculando-o à Igreja
    UPDATE public.profiles
    SET igreja_id = v_igreja_id
    WHERE id = auth.uid();

    RETURN TRUE;
END;
$$;

-- Notifica o PostgREST para reconhecer a nova Schema e Funções
NOTIFY pgrst, 'reload schema';
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
-- Tabela de Departamentos/Categorias do Checklist (Ex: Câmera, Luz, Resolume, Som)
CREATE TABLE IF NOT EXISTS public.checklist_departamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    icone TEXT DEFAULT 'CheckSquare',
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Itens de cada Departamento (Ex: "Limpar Lentes", "Ligar TV")
CREATE TABLE IF NOT EXISTS public.checklist_itens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    departamento_id UUID REFERENCES public.checklist_departamentos(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Submissões (Quem concluiu o checklist de tal departamento hoje?)
-- Isso evita que o mesmo usuário não ganhe XP infinito clicando várias vezes no mesmo dia.
CREATE TABLE IF NOT EXISTS public.checklist_submissoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    membro_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    departamento_id UUID REFERENCES public.checklist_departamentos(id) ON DELETE CASCADE,
    data_submissao DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(membro_id, departamento_id, data_submissao) -- Apenas uma submissão por função por dia
);

-- Políticas RLS (Row Level Security)

-- Departamentos (Todos leem, Admins editam)
ALTER TABLE public.checklist_departamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de checklist_departamentos para autenticados" ON public.checklist_departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciamento de checklist_departamentos para admins" ON public.checklist_departamentos FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Itens (Todos leem, Admins editam)
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de checklist_itens para autenticados" ON public.checklist_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciamento de checklist_itens para admins" ON public.checklist_itens FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Submissões (Usuário cria a sua, todos leem)
ALTER TABLE public.checklist_submissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de checklist_submissoes para autenticados" ON public.checklist_submissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criação de submissoes de checklist pelo próprio usuário" ON public.checklist_submissoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = membro_id);

-- Inserir dados padrão baseados no mockup antigo caso estejam vazios
INSERT INTO public.checklist_departamentos (nome, icone, ordem)
VALUES
    ('camera', 'Video', 1),
    ('luz', 'Lightbulb', 2),
    ('resolume', 'MonitorPlay', 3)
ON CONFLICT (nome) DO NOTHING;

-- Função auxiliar para inserir itens Iniciais de câmera
DO $$
DECLARE
    cam_id UUID;
    luz_id UUID;
    res_id UUID;
BEGIN
    SELECT id INTO cam_id FROM public.checklist_departamentos WHERE nome = 'camera';
    IF FOUND THEN
        INSERT INTO public.checklist_itens (departamento_id, texto, ordem) VALUES
        (cam_id, 'Bateria principal e reserva 100% carregadas', 1),
        (cam_id, 'Cartão de memória limpo/formatado', 2),
        (cam_id, 'White Balance (Balanço de Branco) ajustado', 3),
        (cam_id, 'Lentes limpas sem marcas de dedo', 4),
        (cam_id, 'Comunicação (Intercom/Rádio) testada', 5);
    END IF;

    SELECT id INTO luz_id FROM public.checklist_departamentos WHERE nome = 'luz';
    IF FOUND THEN
        INSERT INTO public.checklist_itens (departamento_id, texto, ordem) VALUES
        (luz_id, 'Cena/Atmosphere pré-configurada (Abertura)', 1),
        (luz_id, 'Patch DMX verificado e sem conflitos', 2),
        (luz_id, 'Testes de blinder e strobo feitos', 3),
        (luz_id, 'Backup no pendrive garantido na mesa', 4),
        (luz_id, 'Refletores direcionados para palco (sem vazar no telão)', 5);
    END IF;

    SELECT id INTO res_id FROM public.checklist_departamentos WHERE nome = 'resolume';
    IF FOUND THEN
        INSERT INTO public.checklist_itens (departamento_id, texto, ordem) VALUES
        (res_id, 'Todos os vídeos do louvor carregados', 1),
        (res_id, 'Vídeos testados até o final (sem áudio na trilha errada)', 2),
        (res_id, 'Layers organizadas (Fundo, Texto, Logo)', 3),
        (res_id, 'Saída/Output mapeada perfeitamente no telão principal', 4),
        (res_id, 'Blackout testado em caso de emergência', 5);
    END IF;

-- Tratando violações de unique ou null id silenciosamente pro seed
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;
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
-- 1. Nova Coluna: Horário Exato do Check-in
ALTER TABLE public.escala_equipe ADD COLUMN IF NOT EXISTS check_in_realizado TIMESTAMP WITH TIME ZONE;

-- 2. Nova Coluna: Registro de quanto de XP esse checkin rendeu (para não dar XP duplicado em caso de cliques duplos)
ALTER TABLE public.escala_equipe ADD COLUMN IF NOT EXISTS xp_ganho INTEGER DEFAULT 0;

-- OBS: Essas informações nos ajudarão a exibir a Patente (Elo) no perfil do voluntário com base no histórico real e tolerâncias de atraso configuradas no sistema de Check-in.
-- 1. Criação da Tabela de Notificações
CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membro_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'sistema', -- 'escala', 'conquista', 'sistema'
    lida BOOLEAN DEFAULT false,
    link_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Segurança: RLS (Row Level Security)
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas suas próprias notificações
CREATE POLICY "Usuários veem suas próprias notificações"
    ON notificacoes
    FOR SELECT
    USING (auth.uid() = membro_id);

-- Usuários podem atualizar suas próprias notificações (ex: marcar como lida)
CREATE POLICY "Usuários podem atualizar suas notificações"
    ON notificacoes
    FOR UPDATE
    USING (auth.uid() = membro_id);
    
-- Usuários podem deletar (limpar) suas notificações (Opcional)
CREATE POLICY "Usuários podem limpar suas notificações"
    ON notificacoes
    FOR DELETE
    USING (auth.uid() = membro_id);

-- O Sistema/Admins (ou próprio usuário) podem inserir (Necessário para a Trigger e para o Frontend se quiser)
CREATE POLICY "Autenticados podem inserir"
    ON notificacoes
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Habilitar Realtime (O Segredo para pular na tela instantaneamente)
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;

-- 4. Função Automática (Trigger): Notificar ao ser Escalado
CREATE OR REPLACE FUNCTION notify_user_on_scale_assignment()
RETURNS TRIGGER AS $$
DECLARE
    nome_culto TEXT;
    data_culto TEXT;
BEGIN
    -- Busca o nome e dia do culto para colocar na mensagem
    SELECT titulo, to_char(data_horario, 'DD/MM') INTO nome_culto, data_culto
    FROM escalas 
    WHERE id = NEW.escala_id;

    -- Se o administrador inseriu alguem com status "pendente", cria a notificação!
    IF NEW.status = 'pendente' THEN
        INSERT INTO notificacoes (membro_id, titulo, mensagem, tipo, link_url)
        VALUES (
            NEW.membro_id, 
            'Nova Escala Diária!', 
            'Você foi convocado para servir em: ' || nome_culto || ' dia ' || data_culto || '. Confirme sua presença na aba de escalas.', 
            'escala', 
            '/escalas'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Engatilhar a função sempre que houver INSERT no banco de escalar equipe
DROP TRIGGER IF EXISTS trigger_notify_scale_assignment ON escala_equipe;
CREATE TRIGGER trigger_notify_scale_assignment
    AFTER INSERT ON escala_equipe
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_on_scale_assignment();
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
-- Criação da tabela para armazenar os dias disponíveis dos voluntários
CREATE TABLE IF NOT EXISTS public.disponibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membro_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_disponivel DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(membro_id, data_disponivel) -- Um membro não pode ter o mesmo dia duplicado
);

-- Habilitar RLS
ALTER TABLE public.disponibilidade ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Regras do Supabase)
-- 1. Qualquer usuário autenticado pode ler a disponibilidade (para o admin enxergar ao escalar)
CREATE POLICY "Leitura de disponibilidade pública para autenticados" 
ON public.disponibilidade 
FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Voluntários só podem inserir seus próprios dias
CREATE POLICY "Voluntários inserem seus dias" 
ON public.disponibilidade 
FOR INSERT WITH CHECK (auth.uid() = membro_id);

-- 3. Voluntários só podem deletar seus próprios dias
CREATE POLICY "Voluntários deletam seus dias" 
ON public.disponibilidade 
FOR DELETE USING (auth.uid() = membro_id);

-- Recarregar cache do esquema no Supabase
NOTIFY pgrst, 'reload schema';
-- Adiciona a coluna para armazenar o recado de justificativa na escala
ALTER TABLE public.escala_equipe 
ADD COLUMN IF NOT EXISTS justificativa TEXT;

-- Força o PostgREST a ler a nova coluna
NOTIFY pgrst, 'reload schema';
-- Função do Robô de Ranking Automático
-- Esta função será acionada toda vez que o XP de um voluntário for alterado.
-- Ela calcula o novo nível baseado na quantidade de XP e atualiza o Perfil automaticamente.

CREATE OR REPLACE FUNCTION atualiza_nivel_voluntario()
RETURNS TRIGGER AS $$
DECLARE
    novo_nivel TEXT;
BEGIN
    -- Lógica do Nível baseada no XP
    IF NEW.xp < 100 THEN
        novo_nivel := 'Bronze';
    ELSIF NEW.xp >= 100 AND NEW.xp < 300 THEN
        novo_nivel := 'Prata';
    ELSIF NEW.xp >= 300 AND NEW.xp < 600 THEN
        novo_nivel := 'Ouro';
    ELSE
        novo_nivel := 'Diamante';
    END IF;

    -- Apenas atualiza o texto se o nível for diferente do atual para não gerar loops infinitos
    IF NEW.nivel IS DISTINCT FROM novo_nivel THEN
        NEW.nivel := novo_nivel;
        
        -- Aqui (no futuro remoto) poderíamos também inserir na tabela de Notificações
        -- avisando o usuário sobre a promoção de nível!
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o gatilho se ele já existir (para evitar erros ao rodar o script novamente)
DROP TRIGGER IF EXISTS trigger_atualiza_nivel ON public.profiles;

-- Cria o Gatilho (Trigger) na Tabela Profiles
CREATE TRIGGER trigger_atualiza_nivel
BEFORE UPDATE OF xp ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION atualiza_nivel_voluntario();

-- Adicional: Se fizermos um UPDATE vazio, ele vai recalcular todo mundo caso tenham XP
-- UPDATE public.profiles SET xp = xp;
-- ==============================================================
-- ACADEMIA MÍDIA 4D - ATUALIZAÇÃO RLS MULTI-TENANT (SaaS)
-- Blindagem Total de Leitura e Escrita entre Diferentes Igrejas
-- ==============================================================

-- 1. FUNÇÕES RLS AUXILIARES
-- SECURITY DEFINER é a chave aqui: ele roda a consulta ignorando o RLS atual.
-- Isso previne o "Infinite Recursion" (Loop infinito) quando a tabela profiles tenta ler ela mesma.
CREATE OR REPLACE FUNCTION public.get_minha_igreja()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT igreja_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 2. Injetar a coluna 'igreja_id' em todas as tabelas centrais do sistema
DO $$
BEGIN
  -- Escalas
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escalas') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='escalas' and column_name='igreja_id') THEN
          ALTER TABLE public.escalas ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Escala Equipe
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escala_equipe') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='escala_equipe' and column_name='igreja_id') THEN
          ALTER TABLE public.escala_equipe ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Notificacoes
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notificacoes') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='notificacoes' and column_name='igreja_id') THEN
          ALTER TABLE public.notificacoes ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Roteiro (Blocos de Culto)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'culto_roteiro') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='culto_roteiro' and column_name='igreja_id') THEN
          ALTER TABLE public.culto_roteiro ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;
  
  -- Treinamentos (Academia)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treinamentos') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='treinamentos' and column_name='igreja_id') THEN
          ALTER TABLE public.treinamentos ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Módulos da Academia
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treinamento_modulos') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='treinamento_modulos' and column_name='igreja_id') THEN
          ALTER TABLE public.treinamento_modulos ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;
  
  -- Departamentos de Checklist
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_departamentos') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='checklist_departamentos' and column_name='igreja_id') THEN
          ALTER TABLE public.checklist_departamentos ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Itens de Checklist
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_items') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='checklist_items' and column_name='igreja_id') THEN
          ALTER TABLE public.checklist_items ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Submissoes de Checklist
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_submissoes') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='checklist_submissoes' and column_name='igreja_id') THEN
          ALTER TABLE public.checklist_submissoes ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;

  -- Disponibilidade Mensal
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disponibilidade_mensal') THEN
      IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='disponibilidade_mensal' and column_name='igreja_id') THEN
          ALTER TABLE public.disponibilidade_mensal ADD COLUMN igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;
      END IF;
  END IF;
END $$;


-- =========================================================================
-- 3. HABILITAR RLS EM TODAS AS TABELAS (Caso alguma tenha ficado p/ tras)
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escalas') THEN ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escala_equipe') THEN ALTER TABLE public.escala_equipe ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notificacoes') THEN ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'culto_roteiro') THEN ALTER TABLE public.culto_roteiro ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treinamentos') THEN ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treinamento_modulos') THEN ALTER TABLE public.treinamento_modulos ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_departamentos') THEN ALTER TABLE public.checklist_departamentos ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_items') THEN ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_submissoes') THEN ALTER TABLE public.checklist_submissoes ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disponibilidade_mensal') THEN ALTER TABLE public.disponibilidade_mensal ENABLE ROW LEVEL SECURITY; END IF;
END $$;


-- =========================================================================
-- 4. REESCREVER RLS E BLINDAR TODAS AS TABELAS CONTRA LEITURA CRUZADA
-- =========================================================================

-- Função para dropar políticas velhas de uma tabela sem precisar do nome exato delas (garantia de limpeza):
DO $$
DECLARE
    pol RECORD;
    tabela TEXT;
    tabelas TEXT[] := ARRAY['profiles', 'escalas', 'escala_equipe', 'notificacoes', 'culto_roteiro', 'treinamentos', 'treinamento_modulos', 'checklist_departamentos', 'checklist_items', 'checklist_submissoes', 'disponibilidade_mensal'];
BEGIN
    FOREACH tabela IN ARRAY tabelas
    LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tabela
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tabela);
        END LOOP;
    END LOOP;
END $$;


-- -----------------------
-- POLÍTICAS: PROFILES
-- -----------------------
-- O próprio dono pode ver/editar OU qualquer pessoa da SUA igreja pode VÊ-LO (Isolamento).
CREATE POLICY "Ver próprio perfil ou da mesma igreja" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR (igreja_id IS NOT NULL AND igreja_id = public.get_minha_igreja())
);
CREATE POLICY "Membro atualiza próprio perfil" ON public.profiles FOR UPDATE USING (id = auth.uid());


-- -----------------------
-- POLÍTICAS: ESCALAS
-- -----------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escalas') THEN
    EXECUTE 'CREATE POLICY "Ver escalas da mesma igreja" ON public.escalas FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia escalas da igreja" ON public.escalas FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;
END $$;

-- -----------------------
-- POLÍTICAS: ESCALA EQUIPE
-- -----------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escala_equipe') THEN
    EXECUTE 'CREATE POLICY "Ver equipe da mesma igreja" ON public.escala_equipe FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia equipe" ON public.escala_equipe FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
    EXECUTE 'CREATE POLICY "Membro altera seu proprio status na equipe" ON public.escala_equipe FOR UPDATE USING (membro_id = auth.uid() AND igreja_id = public.get_minha_igreja())';
  END IF;
END $$;


-- -----------------------
-- POLÍTICAS: ROTEIRO
-- -----------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'culto_roteiro') THEN
    EXECUTE 'CREATE POLICY "Ver roteiro da mesma igreja" ON public.culto_roteiro FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia roteiro" ON public.culto_roteiro FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;
END $$;


-- -----------------------
-- POLÍTICAS: ACADEMIA (TREINAMENTOS E MÓDULOS)
-- -----------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treinamentos') THEN
    EXECUTE 'CREATE POLICY "Ver treinamentos da mesma igreja" ON public.treinamentos FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia treinamentos" ON public.treinamentos FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treinamento_modulos') THEN
    EXECUTE 'CREATE POLICY "Ver modulos da mesma igreja" ON public.treinamento_modulos FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia modulos" ON public.treinamento_modulos FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;
END $$;


-- -----------------------
-- POLÍTICAS: CHECKLISTS
-- -----------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_departamentos') THEN
    EXECUTE 'CREATE POLICY "Ver departamentos de checklist da mesma igreja" ON public.checklist_departamentos FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia departamentos checklist" ON public.checklist_departamentos FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_items') THEN
    EXECUTE 'CREATE POLICY "Ver itens checklist da mesma igreja" ON public.checklist_items FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin gerencia itens checklist" ON public.checklist_items FOR ALL USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_submissoes') THEN
    EXECUTE 'CREATE POLICY "Ver submissoes de checklist da mesma igreja" ON public.checklist_submissoes FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Qualquer membro envia checklist em sua igreja" ON public.checklist_submissoes FOR INSERT WITH CHECK (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Admin altera/deleta submissoes de checklist" ON public.checklist_submissoes FOR UPDATE USING (igreja_id = public.get_minha_igreja() AND public.is_admin())';
  END IF;
END $$;


-- -----------------------
-- POLÍTICAS: NOTIFICACOES E DISPONIBILIDADE
-- -----------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notificacoes') THEN
    EXECUTE 'CREATE POLICY "Membro ve suas proprias notificacoes" ON public.notificacoes FOR SELECT USING (membro_id = auth.uid())';
    EXECUTE 'CREATE POLICY "Admin dispara notificacoes para a igreja" ON public.notificacoes FOR INSERT WITH CHECK (igreja_id = public.get_minha_igreja() AND public.is_admin())';
    EXECUTE 'CREATE POLICY "Sistema insere notificacoes (triggers)" ON public.notificacoes FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Membro marca como lida" ON public.notificacoes FOR UPDATE USING (membro_id = auth.uid())';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disponibilidade_mensal') THEN
    EXECUTE 'CREATE POLICY "Ver disponibilidade da equipe na mesma igreja" ON public.disponibilidade_mensal FOR SELECT USING (igreja_id = public.get_minha_igreja())';
    EXECUTE 'CREATE POLICY "Membro altera propria disponibilidade" ON public.disponibilidade_mensal FOR ALL USING (membro_id = auth.uid() AND igreja_id = public.get_minha_igreja())';
  END IF;
END $$;


-- Notifica o PostgREST para reler todo o Banco com as travas aplicadas
NOTIFY pgrst, 'reload schema';
-- ==============================================================
-- ACADEMIA MÍDIA 4D - ATÔMICO WORKSPACE CREATION
-- Função RPC Segura para criar a igreja e já setar Admin
-- ==============================================================

CREATE OR REPLACE FUNCTION public.criar_nova_igreja(nome_igreja TEXT, codigo TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Super poderes para ignorar RLS e evitar falha silenciosa de Update no React
AS $$
DECLARE
    v_igreja_id UUID;
BEGIN
    -- 1. Cria a Igreja e pega o ID dela
    INSERT INTO public.igrejas (nome, codigo_convite, admin_id)
    VALUES (nome_igreja, codigo, auth.uid())
    RETURNING id INTO v_igreja_id;

    -- 2. Atualiza o Perfil na hora, dando o poder de Admin e vinculando a Igreja
    UPDATE public.profiles
    SET igreja_id = v_igreja_id,
        role = 'admin'
    WHERE id = auth.uid();

    -- Retorna o ID pro React se precisar
    RETURN v_igreja_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
-- =======================================================
-- ACADEMIA MÍDIA 4D - RPC DE CONCLUSÃO DE TREINAMENTO + XP
-- =======================================================
-- Função segura atômica que processa a Gamificação.
-- Quando o voluntário clica em "Marcar como Concluída"
-- o banco registra a aula, soma +15 XP no seu Profile 
-- e dispara uma notificação (Sininho) de reconhecimento.

CREATE OR REPLACE FUNCTION public.concluir_treinamento_com_xp(
    p_treinamento_id UUID,
    p_concluido BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_igreja_id UUID;
    v_xp_atual INTEGER;
    v_titulo_aula TEXT;
    v_xp_recompensa INTEGER := 15; -- Pontos de XP fixos por Aula
    v_ja_concluido BOOLEAN;
BEGIN
    -- 1. Capturar Usuário Logado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- 2. Capturar Igreja e XP Atual do Perfil
    SELECT igreja_id, COALESCE(xp, 0) INTO v_igreja_id, v_xp_atual 
    FROM public.profiles 
    WHERE id = v_user_id;

    -- 3. Capturar Título da Aula para a Notificação
    SELECT titulo INTO v_titulo_aula 
    FROM public.treinamentos 
    WHERE id = p_treinamento_id;

    -- 4. Verificar se ele já havia concluído antes (Anti-Exploit de XP Finito)
    -- Só dá o XP na PRIMEIRA vez que concluir
    SELECT concluido INTO v_ja_concluido
    FROM public.treinamentos_progresso
    WHERE membro_id = v_user_id AND treinamento_id = p_treinamento_id;

    -- 5. Gravar/Atualizar a marcação de Aula Concluída
    INSERT INTO public.treinamentos_progresso (membro_id, treinamento_id, concluido, data_conclusao)
    VALUES (v_user_id, p_treinamento_id, p_concluido, NOW())
    ON CONFLICT (membro_id, treinamento_id) 
    DO UPDATE SET 
        concluido = p_concluido,
        data_conclusao = CASE WHEN p_concluido = true THEN NOW() ELSE NULL END;

    -- 6. Injeção de XP Gamificado e Notificação Exclusiva (Se ele concluiu pela PRIMEIRA vez hoje)
    IF p_concluido = true AND (v_ja_concluido IS NULL OR v_ja_concluido = false) THEN
        
        -- Adicionar +15 XP
        UPDATE public.profiles 
        SET xp = v_xp_atual + v_xp_recompensa
        WHERE id = v_user_id;

        -- Disparar Sininho Triunfal!
        INSERT INTO public.notificacoes (membro_id, igreja_id, titulo, mensagem, tipo, link_url)
        VALUES (
            v_user_id,
            v_igreja_id,
            'Estudioso! +15 XP ✨',
            'Você concluiu a aula "' || v_titulo_aula || '" e ganhou experiência bônus.',
            'conquista',
            '/academia'
        );
        
        RETURN json_build_object('status', 'sucesso_xp', 'xp_adicionado', v_xp_recompensa);
    END IF;

    -- Se ele apenas desmarcou a aula ou já havia feito antes
    RETURN json_build_object('status', 'sucesso_apenas_status');

END;
$$;

NOTIFY pgrst, 'reload schema';
-- ==========================================================
-- ACADEMIA MÍDIA 4D - FUNÇÃO DE DELEÇÃO DE CONTA DE USUÁRIO
-- ==========================================================
-- O lado do cliente nunca tem permissão para dar DELETE na 
-- raiz de autenticação (auth.users) por questões de segurança.
-- Esta função abre um canal supervisionado para que o Cidadão
-- possa apagar a sua PRÓPRIA conta.

CREATE OR REPLACE FUNCTION public.deletar_minha_conta()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Captura o ID do usuário que CHAMOU a função (quem clicou no botão)
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Deletar da raiz auth.users. 
    -- Como nós já configuramos o CASCADE em todas as tabelas (profiles, escalas, checklists, etc)
    -- O PostgreSQL vai se encarregar de triturar todos os dados desse usuário em toda a base!
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
