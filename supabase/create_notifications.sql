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
