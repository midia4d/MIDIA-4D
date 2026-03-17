import { Clapperboard, Lightbulb, Video, Mic, Plus, Clock, AlertTriangle, Radio, Play, CheckCircle2, ChevronUp, ChevronDown, Trash2, Music, MessageSquare, Info, Film } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type RoteiroBloco = {
    id: string;
    titulo: string;
    descricao: string;
    duracao_estimada: string;
    tipo: 'louvor' | 'palavra' | 'aviso' | 'video' | 'comum';
    ordem: number;
    status: 'pendente' | 'ao_vivo' | 'concluido';
    escala_id?: string;
    ao_vivo_desde?: string;
};

type StatusDepartamento = {
    departamento: string;
    status: 'pendente' | 'pronto';
};

export default function Roteiro() {
    const { user } = useOutletContext<{ user: any }>();
    const [isAlerting, setIsAlerting] = useState(false);
    const [blocos, setBlocos] = useState<RoteiroBloco[]>([]);
    const [statusDeps, setStatusDeps] = useState<StatusDepartamento[]>([]);
    const [checklistsProntos, setChecklistsProntos] = useState<string[]>([]);
    const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newBloco, setNewBloco] = useState<Partial<RoteiroBloco>>({
        titulo: '', descricao: '', duracao_estimada: '', tipo: 'comum'
    });

    // Fetch and Realtime Sync
    useEffect(() => {
        fetchBlocos();
        fetchStatusDepartamentos();
        verificarChecklistsDoDia();

        const channel = supabase.channel('roteiro_sync');

        // Escuta alertas do diretor
        channel.on('broadcast', { event: 'alerta_diretor' }, () => {
            setIsAlerting(true);
        });

        // Escuta mudanças na tabela do roteiro
        const dbSub = supabase.channel('roteiro_db_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roteiro_blocos' }, () => {
                fetchBlocos();
            }).subscribe();

        // Escuta mudanças no status dos departamentos
        const statusSub = supabase.channel('status_deps_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roteiro_status_departamentos' }, () => {
                fetchStatusDepartamentos();
            }).subscribe();

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(dbSub);
            supabase.removeChannel(statusSub);
        };
    }, []);

    // Timer Logic
    useEffect(() => {
        const interval = setInterval(() => {
            const liveBlock = blocos.find(b => b.status === 'ao_vivo');
            if (liveBlock && liveBlock.ao_vivo_desde && liveBlock.duracao_estimada) {
                const start = new Date(liveBlock.ao_vivo_desde).getTime();
                const now = new Date().getTime();
                const duracaoMin = parseInt(liveBlock.duracao_estimada.match(/\d+/)?.[0] || '0');
                const duracaoMs = duracaoMin * 60 * 1000;
                
                const diff = duracaoMs - (now - start);
                
                if (diff <= -3600000) { // Mais de 1h de atraso, provavelmente esqueceu ligado
                    setTimeRemaining("--:--");
                } else {
                    const absDiff = Math.abs(diff);
                    const mins = Math.floor(absDiff / 60000);
                    const secs = Math.floor((absDiff % 60000) / 1000);
                    const sign = diff < 0 ? "-" : "";
                    setTimeRemaining(`${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
                }
            } else {
                setTimeRemaining(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [blocos]);

    const fetchStatusDepartamentos = async () => {
        if (!user?.igreja_id) return;
        const { data } = await supabase
            .from('roteiro_status_departamentos')
            .select('*')
            .eq('igreja_id', user.igreja_id);
        if (data) setStatusDeps(data);
    };

    const verificarChecklistsDoDia = async () => {
        if (!user?.igreja_id) return;
        const hoje = new Date().toISOString().split('T')[0];
        
        // Busca submissões de hoje trazendo o nome do departamento via JOIN
        const { data } = await supabase
            .from('checklist_submissoes')
            .select(`
                id,
                checklist_departamentos(nome)
            `)
            .eq('igreja_id', user.igreja_id)
            .gte('data_submissao', hoje);
        
        if (data) {
            const areas = data
                .map((d: any) => d.checklist_departamentos?.nome?.toLowerCase() || '')
                .filter(Boolean);
            setChecklistsProntos(areas);
        }
    };

    const handleUpdateDepStatus = async (dep: string, status: 'pendente' | 'pronto') => {
        if (!user?.igreja_id) return;
        await supabase
            .from('roteiro_status_departamentos')
            .upsert({ 
                igreja_id: user.igreja_id, 
                departamento: dep, 
                status,
                updated_by: user.id
            }, { onConflict: 'igreja_id,departamento' });
    };

    const fetchBlocos = async () => {
        if (!user?.igreja_id) return;

        const { data, error } = await supabase
            .from('roteiro_blocos')
            .select('*')
            .eq('igreja_id', user.igreja_id)
            .order('ordem', { ascending: true });

        if (data) setBlocos(data as RoteiroBloco[]);
        if (error) console.error("Erro ao buscar blocos:", error);
    };

    // Parar alerta
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isAlerting) {
            timer = setTimeout(() => setIsAlerting(false), 4000);
        }
        return () => clearTimeout(timer);
    }, [isAlerting]);

    const handleDirectorAlert = () => {
        setIsAlerting(true);
        supabase.channel('roteiro_sync').send({
            type: 'broadcast',
            event: 'alerta_diretor',
            payload: { disparo: Date.now() }
        });
    };

    const handleSalvarBloco = async () => {
        if (!newBloco.titulo) return;
        if (!user?.igreja_id) {
            if (user?.role === 'admin') {
                alert("Atenção Admin: Seu perfil ainda não está vinculado a uma Igreja. \n\nPor favor, execute o script de reparo no Supabase ou vincule seu usuário a uma igreja no painel de controle.");
            } else {
                alert("Erro: Você não está vinculado a uma igreja. Por favor, peça ao seu líder para te vincular.");
            }
            return;
        }

        try {
            const ordem = blocos.length;
            const { error } = await supabase.from('roteiro_blocos').insert([{ 
                ...newBloco, 
                ordem,
                igreja_id: user.igreja_id 
            }]);

            if (error) throw error;

            setIsModalOpen(false);
            setNewBloco({ titulo: '', descricao: '', duracao_estimada: '', tipo: 'comum' });
        } catch (error: any) {
            console.error("Erro ao salvar bloco:", error);
            alert("Erro ao salvar bloco: " + (error.message || "Tente novamente."));
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        // Se colocar um ao vivo, marca os outros ao_vivo como concluido
        if (status === 'ao_vivo') {
            const currentLive = blocos.find(b => b.status === 'ao_vivo');
            if (currentLive) {
                await supabase.from('roteiro_blocos').update({ status: 'concluido' }).eq('id', currentLive.id);
            }
            // Inicia o cronômetro para o novo bloco
            await supabase.from('roteiro_blocos').update({ status, ao_vivo_desde: new Date().toISOString() }).eq('id', id);
        } else {
            await supabase.from('roteiro_blocos').update({ status }).eq('id', id);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja apagar este bloco?")) {
            await supabase.from('roteiro_blocos').delete().eq('id', id);
        }
    };

    const handleMove = async (id: string, dir: 'up' | 'down') => {
        const idx = blocos.findIndex(b => b.id === id);
        if (dir === 'up' && idx > 0) {
            const prev = blocos[idx - 1];
            await supabase.from('roteiro_blocos').update({ ordem: prev.ordem }).eq('id', id);
            await supabase.from('roteiro_blocos').update({ ordem: blocos[idx].ordem }).eq('id', prev.id);
        } else if (dir === 'down' && idx < blocos.length - 1) {
            const next = blocos[idx + 1];
            await supabase.from('roteiro_blocos').update({ ordem: next.ordem }).eq('id', id);
            await supabase.from('roteiro_blocos').update({ ordem: blocos[idx].ordem }).eq('id', next.id);
        }
        fetchBlocos();
    };

    const getTipoIcon = (tipo: string) => {
        switch (tipo) {
            case 'louvor': return <Music size={16} className="text-purple-500" />;
            case 'palavra': return <MessageSquare size={16} className="text-orange-500" />;
            case 'aviso': return <Info size={16} className="text-blue-500" />;
            case 'video': return <Film size={16} className="text-green-500" />;
            default: return <Clapperboard size={16} className="text-slate-500" />;
        }
    };

    return (
        <div className={cn("max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 transition-colors pb-12", isAlerting ? "bg-red-950/20" : "")}>

            {/* Alerta Visual de Emergência */}
            {isAlerting && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center animate-in fade-in zoom-in duration-300">
                    <div className="absolute inset-0 bg-red-600/20 animate-pulse border-[16px] border-red-600/50"></div>
                    <div className="bg-red-600 text-white px-12 py-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-bounce">
                        <Radio className="animate-ping" size={64} />
                        <h1 className="text-4xl font-black uppercase tracking-widest text-center">Atenção Extrema</h1>
                        <p className="text-xl font-bold opacity-90 text-center">O Diretor acionou um aviso urgente. Olhe para a coordenação!</p>
                    </div>
                </div>
            )}

            {/* Modal Novo Bloco */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border p-6 space-y-4">
                        <h2 className="text-xl font-bold">Adicionar Bloco</h2>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Título do Bloco</label>
                                <input
                                    type="text"
                                    value={newBloco.titulo}
                                    onChange={(e) => setNewBloco({ ...newBloco, titulo: e.target.value })}
                                    placeholder="Ex: Abertura (Louvor)"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tipo</label>
                                    <select
                                        value={newBloco.tipo}
                                        onChange={(e) => setNewBloco({ ...newBloco, tipo: e.target.value as any })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-500 appearance-none"
                                    >
                                        <option value="comum">Comum</option>
                                        <option value="louvor">Louvor</option>
                                        <option value="palavra">Palavra / Mensagem</option>
                                        <option value="aviso">Avisos</option>
                                        <option value="video">Vídeo / Mídia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Duração</label>
                                    <input
                                        type="text"
                                        value={newBloco.duracao_estimada}
                                        onChange={(e) => setNewBloco({ ...newBloco, duracao_estimada: e.target.value })}
                                        placeholder="Ex: 10 min"
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Anotações da Direção (Opcional)</label>
                                <textarea
                                    value={newBloco.descricao}
                                    onChange={(e) => setNewBloco({ ...newBloco, descricao: e.target.value })}
                                    placeholder="Ex: Câmera 1 fica fechada no Pastor, Som sobe BG emocional..."
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 mt-1 outline-none focus:border-blue-500 h-24 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-border">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-muted text-muted-foreground font-bold rounded-xl hover:bg-accent transition-colors">Cancelar</button>
                            <button onClick={handleSalvarBloco} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors">Salvar Roteiro</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <Clapperboard className="text-blue-500" /> Direção de Culto
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">O "Roteiro Cinematográfico". Defina os momentos e sincronize sua equipe.</p>
                </div>

                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-card hover:bg-accent border border-border text-foreground font-bold rounded-xl transition-all flex items-center gap-2 text-sm">
                        <Clock size={16} /> Histórico
                    </button>
                    {user?.role === 'admin' && (
                        <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 text-sm">
                            <Plus size={16} /> Novo Bloco
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Roteiro Principal */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold">Ordem de Serviço (Roteiro)</h2>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Culto • Hoje</span>
                    </div>

                    <div className="space-y-4 relative">
                        {/* Linha de Tempo Visual */}
                        {blocos.length > 0 && <div className="absolute left-[20px] top-6 bottom-6 w-0.5 bg-border z-0" />}

                        {blocos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 bg-card border border-border border-dashed rounded-3xl text-center">
                                <p className="text-muted-foreground font-bold mb-2">Nenhum bloco cadastrado</p>
                                <p className="text-xs text-muted-foreground/60 max-w-md mx-auto">Crie a ordem do culto para que operadores de mídia e câmeras saibam exatamente o que vai acontecer.</p>
                                {user?.role === 'admin' && (
                                    <button onClick={() => setIsModalOpen(true)} className="mt-4 px-4 py-2 bg-blue-500/10 text-blue-500 font-bold rounded-xl text-sm hover:bg-blue-500/20">Adicionar Início</button>
                                )}
                            </div>
                        ) : (
                            blocos.map((bloco, idx) => (
                                <div key={bloco.id} className={cn(
                                    "relative z-10 flex gap-4 transition-all duration-300",
                                    bloco.status === 'ao_vivo' ? "scale-[1.02]" : "opacity-80 hover:opacity-100"
                                )}>

                                    {/* Timeline Marker */}
                                    <div className="pt-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center border-4 border-background shadow-sm shrink-0 transition-colors",
                                            bloco.status === 'ao_vivo' ? "bg-red-500 text-white animate-pulse" :
                                                bloco.status === 'concluido' ? "bg-green-500 text-white" : "bg-card text-muted-foreground border-border"
                                        )}>
                                            {bloco.status === 'ao_vivo' ? <Radio size={16} className="animate-ping" /> :
                                                bloco.status === 'concluido' ? <CheckCircle2 size={16} /> :
                                                    <span className="text-xs font-black">{idx + 1}</span>}
                                        </div>
                                    </div>

                                    {/* Block Card */}
                                    <div className={cn(
                                        "flex-1 bg-card rounded-2xl p-5 shadow-sm border transition-colors",
                                        bloco.status === 'ao_vivo' ? "border-red-500/50 shadow-red-500/10 bg-gradient-to-r from-red-500/5 to-transparent" :
                                            bloco.status === 'concluido' ? "border-green-500/20 bg-green-500/5 opacity-70" : "border-border"
                                    )}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                                        "bg-accent text-muted-foreground"
                                                    )}>
                                                        {getTipoIcon(bloco.tipo)} {bloco.tipo}
                                                    </span>
                                                    {bloco.duracao_estimada && (
                                                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Clock size={12} /> {bloco.duracao_estimada}</span>
                                                    )}
                                                </div>
                                                <h3 className={cn("text-lg font-bold", bloco.status === 'ao_vivo' ? "text-red-500" : "text-foreground")}>{bloco.titulo}</h3>
                                                {bloco.descricao && (
                                                    <p className="text-sm text-muted-foreground mt-2 bg-background/50 p-3 rounded-xl border border-border/50 italic border-l-2 border-l-blue-500/50">
                                                        "{bloco.descricao}"
                                                    </p>
                                                )}
                                                {bloco.status === 'ao_vivo' && timeRemaining && (
                                                    <div className="mt-3 flex items-center gap-2 text-xl font-black font-mono">
                                                        <Clock size={20} className={cn(timeRemaining.startsWith('-') ? "text-red-500 animate-pulse" : "text-blue-500")} />
                                                        <span className={cn(timeRemaining.startsWith('-') ? "text-red-500" : "text-blue-500")}>
                                                            {timeRemaining}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Ações (Apenas Admin) */}
                                            {user?.role === 'admin' && (
                                                <div className="flex items-center gap-2 bg-background p-1.5 rounded-xl border border-border shadow-sm">
                                                    <div className="flex flex-col border-r border-border pr-1">
                                                        <button onClick={() => handleMove(bloco.id, 'up')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"><ChevronUp size={14} /></button>
                                                        <button onClick={() => handleMove(bloco.id, 'down')} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"><ChevronDown size={14} /></button>
                                                    </div>

                                                    {bloco.status !== 'ao_vivo' && (
                                                        <button onClick={() => handleUpdateStatus(bloco.id, 'ao_vivo')} title="Colocar Ao Vivo" className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                                            <Play size={18} className="fill-current" />
                                                        </button>
                                                    )}
                                                    {bloco.status === 'ao_vivo' && (
                                                        <button onClick={() => handleUpdateStatus(bloco.id, 'concluido')} title="Concluir e ir pro próximo" className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors">
                                                            <CheckCircle2 size={18} />
                                                        </button>
                                                    )}

                                                    <button onClick={() => handleDelete(bloco.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border-l border-border pl-2">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Dashboard de Monitoramento Sidebar */}
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">

                        {/* Live indicator se tiver algo rolando */}
                        {(blocos.some(b => b.status === 'ao_vivo') || timeRemaining) && (
                            <div className="absolute top-6 right-6 flex items-center gap-2">
                                {timeRemaining && <span className={cn("text-sm font-black font-mono mr-2", timeRemaining.startsWith('-') ? "text-red-500" : "text-blue-500")}>{timeRemaining}</span>}
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Live</span>
                            </div>
                        )}

                        <h3 className="text-lg font-bold mb-6">Status da Equipe</h3>

                        <div className="space-y-4">
                            {/* Câmeras */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                        (checklistsProntos.includes('camera') || statusDeps.find(d => d.departamento === 'cameras')?.status === 'pronto') 
                                            ? "bg-green-500/10 text-green-500" : "bg-accent text-muted-foreground"
                                    )}>
                                        <Video size={16} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">Câmeras (1, 2)</div>
                                        <div className="text-xs text-muted-foreground">
                                            {checklistsProntos.includes('camera') ? "Checklist Finalizado" : "Aguardando Checklist"}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleUpdateDepStatus('cameras', statusDeps.find(d => d.departamento === 'cameras')?.status === 'pronto' ? 'pendente' : 'pronto')}
                                    className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md transition-all",
                                        statusDeps.find(d => d.departamento === 'cameras')?.status === 'pronto' ? "bg-green-500/20 text-green-500" : "bg-card border border-border text-muted-foreground"
                                    )}
                                >
                                    {statusDeps.find(d => d.departamento === 'cameras')?.status === 'pronto' ? "PRONTO" : "Ocupado"}
                                </button>
                            </div>

                            {/* Luz */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                        (checklistsProntos.includes('luz') || checklistsProntos.includes('iluminação') || statusDeps.find(d => d.departamento === 'luz')?.status === 'pronto') 
                                            ? "bg-green-500/10 text-green-500" : "bg-accent text-muted-foreground"
                                    )}>
                                        <Lightbulb size={16} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">Luz / DMX</div>
                                        <div className="text-xs text-muted-foreground">
                                            {checklistsProntos.includes('luz') || checklistsProntos.includes('iluminação') ? "Cenas Prontas" : "Carregando Cenas"}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleUpdateDepStatus('luz', statusDeps.find(d => d.departamento === 'luz')?.status === 'pronto' ? 'pendente' : 'pronto')}
                                    className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md transition-all",
                                        statusDeps.find(d => d.departamento === 'luz')?.status === 'pronto' ? "bg-green-500/20 text-green-500" : "bg-card border border-border text-muted-foreground"
                                    )}
                                >
                                    {statusDeps.find(d => d.departamento === 'luz')?.status === 'pronto' ? "PRONTO" : "Ocupado"}
                                </button>
                            </div>

                            {/* Som */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                        (checklistsProntos.includes('som') || checklistsProntos.includes('audio') || statusDeps.find(d => d.departamento === 'som')?.status === 'pronto') 
                                            ? "bg-green-500/10 text-green-500" : "bg-accent text-muted-foreground"
                                    )}>
                                        <Mic size={16} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">Som (PA)</div>
                                        <div className="text-xs text-muted-foreground">
                                            {checklistsProntos.includes('som') || checklistsProntos.includes('audio') ? "Áudio OK" : "Passagem de Som"}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleUpdateDepStatus('som', statusDeps.find(d => d.departamento === 'som')?.status === 'pronto' ? 'pendente' : 'pronto')}
                                    className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md transition-all",
                                        statusDeps.find(d => d.departamento === 'som')?.status === 'pronto' ? "bg-green-500/20 text-green-500" : "bg-card border border-border text-muted-foreground"
                                    )}
                                >
                                    {statusDeps.find(d => d.departamento === 'som')?.status === 'pronto' ? "PRONTO" : "Ocupado"}
                                </button>
                            </div>
                        </div>

                        {user?.role === 'admin' && (
                            <button
                                onClick={handleDirectorAlert}
                                className="w-full mt-8 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-red-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                <AlertTriangle size={16} className={cn(isAlerting && "animate-ping")} />
                                {isAlerting ? "Alerta Ativo (Pisca nas telas)" : "Alerta de Emergência (Geral)"}
                            </button>
                        )}
                        <p className="text-center text-[10px] text-muted-foreground mt-3 font-medium uppercase tracking-widest">Ação para chamar a atenção da equipe</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
