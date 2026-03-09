-- =================================================================================
-- CORREÇÃO DE DELEÇÃO CASCADE (Esmagador de Chaves Estrangeiras Rígidas)
-- Resolve o erro: "violates foreign key constraint ... no ON DELETE CASCADE"
-- =================================================================================

-- 1. Tabela: checklist_submissoes
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checklist_submissoes') THEN
    ALTER TABLE public.checklist_submissoes DROP CONSTRAINT IF EXISTS checklist_submissoes_membro_id_fkey;
    ALTER TABLE public.checklist_submissoes ADD CONSTRAINT checklist_submissoes_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Garantia na Tabela: escala_equipe (Sempre bom reforçar caso a escala também trave)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escala_equipe') THEN
    ALTER TABLE public.escala_equipe DROP CONSTRAINT IF EXISTS escala_equipe_membro_id_fkey;
    ALTER TABLE public.escala_equipe ADD CONSTRAINT escala_equipe_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Garantia na Tabela: notificacoes
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notificacoes') THEN
    ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_membro_id_fkey;
    ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Garantia na Tabela: disponibilidade_mensal
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disponibilidade_mensal') THEN
    ALTER TABLE public.disponibilidade_mensal DROP CONSTRAINT IF EXISTS disponibilidade_mensal_membro_id_fkey;
    ALTER TABLE public.disponibilidade_mensal ADD CONSTRAINT disponibilidade_mensal_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Avisar o Cache de API REST das mudanças nas regras estruturais
NOTIFY pgrst, 'reload schema';
