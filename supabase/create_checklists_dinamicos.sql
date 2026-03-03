-- Tabela de Departamentos/Categorias do Checklist (Ex: Câmera, Luz, Resolume, Som)
CREATE TABLE IF NOT EXISTS public.checklist_departamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    icone TEXT DEFAULT 'CheckSquare',
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Itens de cada Departamento (Ex: "Limpar Lentes", "Ligar TV")
CREATE TABLE IF NOT EXISTS public.checklist_itens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    departamento_id UUID REFERENCES public.checklist_departamentos(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Submissões (Quem concluiu o checklist de tal departamento hoje?)
-- Isso evita que o mesmo usuário não ganhe XP infinito clicando várias vezes no mesmo dia.
CREATE TABLE IF NOT EXISTS public.checklist_submissoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    membro_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    departamento_id UUID REFERENCES public.checklist_departamentos(id) ON DELETE CASCADE,
    data_submissao DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(membro_id, departamento_id, data_submissao) -- Apenas uma submissão por função por dia
);

-- Políticas RLS (Row Level Security)

-- Departamentos (Todos leem, Admins editam)
ALTER TABLE public.checklist_departamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de checklist_departamentos para autenticados" ON public.checklist_departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciamento de checklist_departamentos para admins" ON public.checklist_departamentos FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Itens (Todos leem, Admins editam)
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de checklist_itens para autenticados" ON public.checklist_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerenciamento de checklist_itens para admins" ON public.checklist_itens FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Submissões (Usuário cria a sua, todos leem)
ALTER TABLE public.checklist_submissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de checklist_submissoes para autenticados" ON public.checklist_submissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criação de submissoes de checklist pelo próprio usuário" ON public.checklist_submissoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = membro_id);

-- Inserir dados padrão baseados no mockup antigo caso estejam vazios
INSERT INTO public.checklist_departamentos (nome, icone, ordem)
VALUES
    ('camera', 'Video', 1),
    ('luz', 'Lightbulb', 2),
    ('resolume', 'MonitorPlay', 3)
ON CONFLICT (nome) DO NOTHING;

-- Função auxiliar para inserir itens Iniciais de câmera
DO $$
DECLARE
    cam_id UUID;
    luz_id UUID;
    res_id UUID;
BEGIN
    SELECT id INTO cam_id FROM public.checklist_departamentos WHERE nome = 'camera';
    IF FOUND THEN
        INSERT INTO public.checklist_itens (departamento_id, texto, ordem) VALUES
        (cam_id, 'Bateria principal e reserva 100% carregadas', 1),
        (cam_id, 'Cartão de memória limpo/formatado', 2),
        (cam_id, 'White Balance (Balanço de Branco) ajustado', 3),
        (cam_id, 'Lentes limpas sem marcas de dedo', 4),
        (cam_id, 'Comunicação (Intercom/Rádio) testada', 5);
    END IF;

    SELECT id INTO luz_id FROM public.checklist_departamentos WHERE nome = 'luz';
    IF FOUND THEN
        INSERT INTO public.checklist_itens (departamento_id, texto, ordem) VALUES
        (luz_id, 'Cena/Atmosphere pré-configurada (Abertura)', 1),
        (luz_id, 'Patch DMX verificado e sem conflitos', 2),
        (luz_id, 'Testes de blinder e strobo feitos', 3),
        (luz_id, 'Backup no pendrive garantido na mesa', 4),
        (luz_id, 'Refletores direcionados para palco (sem vazar no telão)', 5);
    END IF;

    SELECT id INTO res_id FROM public.checklist_departamentos WHERE nome = 'resolume';
    IF FOUND THEN
        INSERT INTO public.checklist_itens (departamento_id, texto, ordem) VALUES
        (res_id, 'Todos os vídeos do louvor carregados', 1),
        (res_id, 'Vídeos testados até o final (sem áudio na trilha errada)', 2),
        (res_id, 'Layers organizadas (Fundo, Texto, Logo)', 3),
        (res_id, 'Saída/Output mapeada perfeitamente no telão principal', 4),
        (res_id, 'Blackout testado em caso de emergência', 5);
    END IF;

-- Tratando violações de unique ou null id silenciosamente pro seed
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;
