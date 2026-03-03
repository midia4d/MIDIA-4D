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
