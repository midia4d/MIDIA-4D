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
