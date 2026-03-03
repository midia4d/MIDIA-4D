-- Criação da tabela para armazenar as Notificações de cada usuário
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT false,
    tipo TEXT DEFAULT 'info', -- 'info', 'warning', 'success', 'escala'
    link TEXT, -- Opcional, rota para redirecionar o usuário ao clicar (Ex: '/escalas')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- Um usuário pode LER apenas as suas próprias notificações
CREATE POLICY "Usuários veem suas próprias notificações"
ON public.notificacoes FOR SELECT
USING (auth.uid() = usuario_id);

-- Apenas admins podem CRIAR notificações livremente, mas o próprio app 
-- também pode criar inserindo diretamente via SQL local usando service_role/frontend admin permissions
-- Como a regra de negocio exige que Admin notifique, vamos garantir isso:
CREATE POLICY "Admins podem inserir notificações para outros"
ON public.notificacoes FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- O usuário dono da notificação pode marcá-la como lida (UPDATE)
CREATE POLICY "Usuário pode marcar sua notificação como lida"
ON public.notificacoes FOR UPDATE
USING (auth.uid() = usuario_id);

-- O usuário pode deletar suas proprias notificações (opcional futuro)
CREATE POLICY "Usuário pode deletar sua notificação"
ON public.notificacoes FOR DELETE
USING (auth.uid() = usuario_id);

-- Notifica o PostgREST para ler a nova tabela
NOTIFY pgrst, 'reload schema';
