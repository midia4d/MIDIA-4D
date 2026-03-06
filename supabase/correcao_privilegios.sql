-- ==========================================
-- CORREÇÃO DE PRIVILÉGIOS (API DO SUPABASE)
-- Como deletamos o Schema "public", precisamos dizer ao Supabase
-- que os usuários normais (da internet e logados) podem ler e gravar nas tabelas.
-- ==========================================

-- 1. Dar permissão de uso do schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Dar permissão em TODAS AS TABELAS para essas "roles" da API
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Dar permissão nas funções (RPCs e Triggers)
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Dar permissão nas sequências (ID's automáticos)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 5. Para o futuro: Se você criar novas tabelas lá no botão "New Table", elas já vão vir abertas pra API:
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- ==========================================
-- ATIVANDO ROW LEVEL SECURITY (RLS) - DEIXANDO ABERTO (SINGLE-TENANT)
-- Se você quiser garantir que qualquer um logado veja tudo:
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em escalas" ON public.escalas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.escala_equipe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em equipe" ON public.escala_equipe FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.disponibilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em disponibilidade" ON public.disponibilidade FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em notifica" ON public.notificacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.checklist_departamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em depts" ON public.checklist_departamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em itens" ON public.checklist_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.checklist_submissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em submis" ON public.checklist_submissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.roteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em roteiros" ON public.roteiros FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.roteiro_blocos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total para autenticados em blocos" ON public.roteiro_blocos FOR ALL TO authenticated USING (true) WITH CHECK (true);
