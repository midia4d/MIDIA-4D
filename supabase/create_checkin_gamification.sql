-- 1. Nova Coluna: Horário Exato do Check-in
ALTER TABLE public.escala_equipe ADD COLUMN IF NOT EXISTS check_in_realizado TIMESTAMP WITH TIME ZONE;

-- 2. Nova Coluna: Registro de quanto de XP esse checkin rendeu (para não dar XP duplicado em caso de cliques duplos)
ALTER TABLE public.escala_equipe ADD COLUMN IF NOT EXISTS xp_ganho INTEGER DEFAULT 0;

-- OBS: Essas informações nos ajudarão a exibir a Patente (Elo) no perfil do voluntário com base no histórico real e tolerâncias de atraso configuradas no sistema de Check-in.
