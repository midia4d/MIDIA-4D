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
