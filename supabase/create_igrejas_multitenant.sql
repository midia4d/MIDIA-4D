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
