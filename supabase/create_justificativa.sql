-- Adiciona a coluna para armazenar o recado de justificativa na escala
ALTER TABLE public.escala_equipe 
ADD COLUMN IF NOT EXISTS justificativa TEXT;

-- Força o PostgREST a ler a nova coluna
NOTIFY pgrst, 'reload schema';
