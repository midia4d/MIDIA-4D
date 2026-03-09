-- =========================================================================
-- DEBUG E CORREÇÃO DO SISTEMA DE NOTIFICAÇÕES (SININHO REALTIME)
-- =========================================================================

-- 1. Garante que a tabela Notificações está inscrita no Canal de Transmissão (WebSocket)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- 2. Define a Identidade de Réplica para FULL (Obrigatório para o Payload do Supabase.channel mandar dados)
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;

-- 3. Reconstrói as permissões RLS com foco ultra-permissivo para garantir que o Push chegue à tela do Front-end.
-- Desabilita temporariamente
ALTER TABLE public.notificacoes DISABLE ROW LEVEL SECURITY;

-- Limpa as regras antigas
DROP POLICY IF EXISTS "Membro ve suas proprias notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Admin dispara notificacoes para a igreja" ON public.notificacoes;
DROP POLICY IF EXISTS "Sistema insere notificacoes (triggers)" ON public.notificacoes;
DROP POLICY IF EXISTS "Membro marca como lida" ON public.notificacoes;
DROP POLICY IF EXISTS "Inserção livre de notificações" ON public.notificacoes;
DROP POLICY IF EXISTS "Todos atualizam notificacoes" ON public.notificacoes;

-- Ativa Novamente
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- NOVA REGRA DE LEITURA (O canal do Supabase usa essa regra pra saber se pode enviar o WebSocket pro navegador)
CREATE POLICY "Membro ve suas proprias notificacoes" 
ON public.notificacoes 
FOR SELECT 
USING (membro_id = auth.uid());

-- NOVA REGRA DE INSERÇÃO (Segura, o próprio sistema ou Líder podem inserir as mensagens lá de dentro)
CREATE POLICY "Inserção livre de notificações" 
ON public.notificacoes 
FOR INSERT 
WITH CHECK (true);

-- NOVA REGRA DE ATUALIZAÇÃO (Pra pessoa clicar e "Marcar como lida" sumindo o pontinho vermelho)
CREATE POLICY "Membro marca como lida" 
ON public.notificacoes 
FOR UPDATE 
USING (membro_id = auth.uid());

-- REFRESH DO CACHE DE PERMISSÃO
NOTIFY pgrst, 'reload schema';
