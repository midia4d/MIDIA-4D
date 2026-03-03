import { useState, useEffect } from 'react';
import { CheckSquare, AlertTriangle, CheckCircle2, ChevronRight, Video, Lightbulb, MonitorPlay, Loader2, Plus, Trash2, X, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getElo, type EloConfig } from '../lib/gamification';
import { LevelUpModal } from '../components/LevelUpModal';
interface Departamento {
    id: string;
    nome: string;
    icone: string;
    ordem: number;
}

interface ChecklistItem {
    id: string;
    departamento_id: string;
    texto: string;
    ordem: number;
    check?: boolean; // Estado local do frontend
}

// Para a lógica de Bloqueio/Visão e Auditoria
interface MinhaEscala {
    id: string; // id da escala_equipe
    escala_id: string; // id da tabela escalas (culto)
    status: string;
    orientacao: string;
    departamento_id: string;
    escala_titulo: string;
    escala_horario: string;
    check_in_realizado: string | null;
}

export default function Checklists() {
    const { user } = useOutletContext<{ user: any }>();

    // Estados principais
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [itens, setItens] = useState<ChecklistItem[]>([]);
    const [activeDepId, setActiveDepId] = useState<string>('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // Controle de Acesso (Voluntário)
    const [minhasEscalasHoje, setMinhasEscalasHoje] = useState<MinhaEscala[]>([]);
    const [escalaAtiva, setEscalaAtiva] = useState<MinhaEscala | null>(null);

    // Controle da Tela Mestra Admin
    const [adminTab, setAdminTab] = useState<'checklists' | 'auditoria'>('checklists');
    const [auditoriaLogs, setAuditoriaLogs] = useState<any[]>([]);

    // Estado do Modal de Edição    // Admin Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDep, setEditingDep] = useState<any | null>(null);
    const [newDepName, setNewDepName] = useState('');
    const [newItemText, setNewItemText] = useState('');

    // Level Up / Gamificação Modal State
    const [levelUpData, setLevelUpData] = useState<{ oldElo: EloConfig, newElo: EloConfig } | null>(null);

    // Initial Fetch Dados Iniciais
    const fetchChecklists = async () => {
        setIsLoading(true);
        try {
            // 1. Departamentos
            const { data: depsData, error: depsError } = await supabase
                .from('checklist_departamentos')
                .select('*')
                .order('ordem', { ascending: true });

            if (depsError) throw depsError;
            setDepartamentos(depsData || []);

            // O primeiro departamento se torna ativo por padrão
            if (depsData && depsData.length > 0 && !activeDepId) {
                setActiveDepId(depsData[0].id);
            }

            // 2. Itens
            const { data: itensData, error: itensError } = await supabase
                .from('checklist_itens')
                .select('*')
                .order('ordem', { ascending: true });

            if (itensError) throw itensError;

            // Adiciona a propriedade "check: false" para controle de interface state
            const itensWithCheck = (itensData || []).map(i => ({ ...i, check: false }));
            setItens(itensWithCheck);

            // Verifica se o usuário já submeteu esse departamento hoje
            checkSubmissionStatus(depsData?.[0]?.id || '');

            // 3. Checagem de Segurança: O usuário está escalado hoje? (Se não for admin navegando livre)
            if (user?.role !== 'admin') {

                // Busca escalas do dia onde o user tá escalado
                // Como data_horario guarda hora (ex: 2024-03-01T23:00:00.000Z), pegamos todas e filtramos no JS pela data local
                const { data: escalasUsuario } = await supabase
                    .from('escala_equipe')
                    .select(`
id,
    status,
    orientacao,
    departamento_id,
    escala_id,
    check_in_realizado,
    escalas!inner(titulo, data_horario)
        `)
                    .eq('membro_id', user.id)
                    .neq('status', 'recusado');

                if (escalasUsuario && escalasUsuario.length > 0) {
                    // Filtra no client as de hoje para evitar timezone bugs do database
                    const mapeadas = escalasUsuario
                        .filter((e: any) => {
                            const dataCultoStr = new Date(e.escalas.data_horario).toLocaleDateString();
                            const dataHojeStr = new Date().toLocaleDateString();
                            return dataCultoStr === dataHojeStr;
                        })
                        .map((e: any) => ({
                            id: e.id,
                            escala_id: e.escala_id,
                            status: e.status,
                            orientacao: e.orientacao,
                            departamento_id: e.departamento_id,
                            escala_titulo: e.escalas.titulo,
                            escala_horario: e.escalas.data_horario,
                            check_in_realizado: e.check_in_realizado
                        }));

                    if (mapeadas.length > 0) {
                        setMinhasEscalasHoje(mapeadas);

                        const depEscalado = mapeadas[0].departamento_id;
                        if (depEscalado) {
                            setActiveDepId(depEscalado);
                            setEscalaAtiva(mapeadas[0]);
                            checkSubmissionStatus(depEscalado);
                        }
                    } else {
                        setMinhasEscalasHoje([]);
                    }
                } else {
                    setMinhasEscalasHoje([]);
                }
            } else {
                // Se é Admin, vamos carregar os dados de auditoria logo de cara em Background
                carregarAuditoria();
            }

        } catch (error) {
            console.error("Erro ao puxar checklists:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const carregarAuditoria = async () => {

        const { data, error } = await supabase
            .from('checklist_submissoes')
            .select(`
id,
    data_submissao,
    departamento_id,
    checklist_departamentos(nome),
    profiles(id, nome),
    escala_id,
    escala: escala_id(titulo, data_horario)
            `)
            .order('data_submissao', { ascending: false })
            .limit(100);

        if (error) {
            console.error("Erro ao puxar auditoria", error);
            return;
        }

        if (data) {
            setAuditoriaLogs(data);
        }
    };

    useEffect(() => {
        fetchChecklists();
    }, []);

    // Sempre que o departamento ativo muda, checar se ele já foi finalizado no db para aquele membro hoje
    const checkSubmissionStatus = async (depId: string) => {
        if (!depId || !user) return;

        setIsFinished(false);
        const query = supabase
            .from('checklist_submissoes')
            .select('*')
            .eq('membro_id', user.id)
            .eq('departamento_id', depId);

        // Se o voluntário tem uma escala vinculada desse depto, confere através da chave exata para evitar falhas de Timezone UTC no banco
        if (escalaAtiva && escalaAtiva.escala_id) {
            query.eq('escala_id', escalaAtiva.escala_id);
        } else {
            query.gte('data_submissao', new Date().toISOString().split('T')[0] + ' 00:00:00');
        }

        const { data } = await query.single();

        if (data) {
            setIsFinished(true);
            // Também marca todos os checks da UI visualmente baseados nesse DEP pra true pra ele ver que acabou
            setItens(prev => prev.map(i => i.departamento_id === depId ? { ...i, check: true } : i));
        } else {
            // Limpa visualmente se mudar de aba e não tiver feito
            setItens(prev => prev.map(i => i.departamento_id === depId ? { ...i, check: false } : i));
        }
    };

    const handleTabChange = (depId: string) => {
        setActiveDepId(depId);
        checkSubmissionStatus(depId);
    };

    // Ações de Toggle Visual
    const handleToggleCheck = (itemId: string) => {
        if (isFinished) return;

        setItens(prev => prev.map(item =>
            item.id === itemId ? { ...item, check: !item.check } : item
        ));
    };

    // Computação
    const activeItems = itens.filter(i => i.departamento_id === activeDepId);
    const isAllChecked = activeItems.length > 0 && activeItems.every(item => item.check);
    const checkedCount = activeItems.filter(item => item.check).length;
    const activeDep = departamentos.find(d => d.id === activeDepId);

    // Finalização de Protocolo e Ganho de XP
    const handleFinalizarProtocolo = async () => {
        if (!isAllChecked || isFinished || !activeDepId) return;

        setIsSaving(true);
        try {
            const payloadData: any = { membro_id: user.id, departamento_id: activeDepId };
            // Se estiver vinculado à uma escala preenche (Auditoria Premium)
            if (escalaAtiva && escalaAtiva.escala_id) {
                payloadData.escala_id = escalaAtiva.escala_id;
            }

            const { error: subError } = await supabase
                .from('checklist_submissoes')
                .insert([payloadData]);

            if (subError) throw subError;

            // 1. Pegar XP Atual
            const { data: profile } = await supabase
                .from('profiles')
                .select('xp')
                .eq('id', user.id)
                .single();

            const currentXp = profile?.xp || 0;
            const xpGanho = 10;

            // 2. Somar +XP
            await supabase
                .from('profiles')
                .update({ xp: currentXp + xpGanho })
                .eq('id', user.id);

            setIsFinished(true);

            // 3. Checar Evento de Subida de Elo
            const oldElo = getElo(currentXp);
            const newElo = getElo(currentXp + xpGanho);

            if (newElo.name !== oldElo.name && newElo.minXp > oldElo.minXp) {
                setLevelUpData({ oldElo, newElo });
            } else {
                alert(`Protocolo do departamento ${activeDep?.nome} concluído! Você ganhou + ${xpGanho} XP.`);
            }

        } catch (error: any) {
            console.error("Erro ao finalizar checklist:", error);
            if (error?.code === '23505') {
                alert("Você já ganhou XP para o checklist deste departamento hoje!");
                setIsFinished(true);
            } else {
                alert("Erro ao sincronizar. Tente novamente.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Ícones dinâmicos / Fallback mapeado
    const getDynamicIcon = (iconName: string, size = 18) => {
        const str = (iconName || '').toLowerCase();
        if (str.includes('camera')) return <Video size={size} />;
        if (str.includes('luz')) return <Lightbulb size={size} />;
        if (str.includes('resolume')) return <MonitorPlay size={size} />;
        return <CheckSquare size={size} />;
    };

    // ============================================
    //            ADMIN EDIT FUNCTIONS
    // ============================================
    const openAdminModal = () => setIsEditModalOpen(true);

    const handleCreateDep = async () => {
        if (!newDepName.trim()) return;
        const { data, error } = await supabase.from('checklist_departamentos').insert({ nome: newDepName, ordem: departamentos.length + 1 }).select().single();
        if (!error && data) {
            setDepartamentos([...departamentos, data]);
            setNewDepName('');
        }
    };

    const handleDeleteDep = async (depId: string) => {
        if (!confirm("Excluir este departamento também apagará todos os seus itens. Confirma?")) return;
        await supabase.from('checklist_departamentos').delete().eq('id', depId);
        setDepartamentos(departamentos.filter(d => d.id !== depId));
        if (activeDepId === depId) setActiveDepId(departamentos[0]?.id || '');
    };

    const handleCreateItem = async (depId: string) => {
        if (!newItemText.trim()) return;
        const itemsDep = itens.filter(i => i.departamento_id === depId);
        const { data, error } = await supabase.from('checklist_itens').insert({ departamento_id: depId, texto: newItemText, ordem: itemsDep.length + 1 }).select().single();
        if (!error && data) {
            setItens([...itens, { ...data, check: false }]);
            setNewItemText('');
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        await supabase.from('checklist_itens').delete().eq('id', itemId);
        setItens(itens.filter(i => i.id !== itemId));
    };


    const handleInvalidarXP = async (logId: string, membroId: string, profileNome: string) => {
        if (!confirm(`Tribunal Mídia 4D: Você está prestes a ANULAR o Checklist de ${profileNome}. Isso removerá os últimos 10 XP ganhos pela pessoa na liderança.Prosseguir com a anulação ? `)) return;

        try {
            // 1. Apaga a submissão para liberar de novo
            await supabase.from('checklist_submissoes').delete().eq('id', logId);

            // 2. Tira os 10 XP com amor cristão
            const { data: profile } = await supabase.from('profiles').select('xp').eq('id', membroId).single();
            if (profile) {
                await supabase.from('profiles').update({ xp: Math.max(0, profile.xp - 10) }).eq('id', membroId);
            }

            alert(`A fraude de ${profileNome} foi anulada!(-10 XP).`);
            carregarAuditoria(); // Atualiza a lista pra sumir o log

        } catch (error) {
            console.error("Erro ao invalidar", error);
            alert("Erro ao aplicar punição.");
        }
    };


    if (isLoading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

            {/* Header Geral */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Checklists da Equipe</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Padrão de excelência. Conclua as etapas do seu departamento antes do louvor iniciar.</p>
                </div>

                {user?.role === 'admin' && (
                    <div className="flex gap-4 items-center">
                        <button onClick={openAdminModal} className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-500 font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 text-sm border border-blue-200 dark:border-blue-500/20">
                            <Settings2 size={16} /> Configurar Checklists
                        </button>
                    </div>
                )}
            </div>

            {/* Abas Superiores (Apenas Admin) */}
            {user?.role === 'admin' && (
                <div className="flex bg-card p-1 rounded-xl border border-border w-max shadow-sm -mt-2">
                    <button onClick={() => setAdminTab('checklists')} className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all", adminTab === 'checklists' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}> Visão Geral </button>
                    <button onClick={() => setAdminTab('auditoria')} className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all", adminTab === 'auditoria' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}> Auditoria Anti-Fraude </button>
                </div>
            )}

            {/* SE ADMIN CLICOU EM AUDITORIA */}
            {user?.role === 'admin' && adminTab === 'auditoria' ? (
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                    <h2 className="text-xl font-black mb-1">Registro de Submissões</h2>
                    <p className="text-sm text-muted-foreground mb-6">Fique de olho em quem enviou checklist sem executar de verdade. Anule submissões fraudulentas clicando no X.</p>

                    {auditoriaLogs.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-background/50">Nenhuma submissão recente registrada.</div>
                    ) : (
                        <div className="space-y-3">
                            {auditoriaLogs.map(log => {
                                const horarioEnvio = new Date(log.data_submissao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                const dataEnvio = new Date(log.data_submissao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                                return (
                                    <div key={log.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-accent/50 transition">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                                                {getDynamicIcon(log.checklist_departamentos?.nome, 18)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-foreground">
                                                    {log.profiles?.nome} <span className="mx-1 text-muted-foreground font-normal">enviou 100% de</span> <span className="capitalize">{log.checklist_departamentos?.nome}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                                                    {log.escala && typeof log.escala === 'object' && !Array.isArray(log.escala) && 'titulo' in log.escala && (
                                                        <span className="bg-accent px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-border">
                                                            Culto vinculado: {log.escala.titulo}
                                                        </span>
                                                    )}
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                                                        // Se ele mandou > 2 horas ANTES do culto daria + XP extra, mas aqui só avisamos se fez em cima da hora
                                                        // Pra simplificar visual vamos apenas dar destaque a hora de envio
                                                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                                    )}>
                                                        Realizado em: {dataEnvio} às ⏱️ {horarioEnvio}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleInvalidarXP(log.id, log.profiles?.id, log.profiles?.nome)}
                                            title="Invalidar XP"
                                            className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* TELA PADRÃO DE CHECKLIST */}

                    {/* ALERTA DE BLOQUEIO PARA VOLUNTÁRIOS NÃO ESCALADOS E SEM OBS */}
                    {user?.role !== 'admin' && minhasEscalasHoje.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border border-dashed rounded-3xl text-center shadow-sm">
                            <AlertTriangle size={48} className="text-yellow-500 mb-4" />
                            <h3 className="text-2xl font-black mb-2 text-foreground">Acesso Bloqueado Hoje</h3>
                            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                                O sistema anticheat da Mídia 4D indica que você <strong className="text-foreground">não está escalado no sistema</strong> para participar de nenhum culto no dia de hoje.
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 uppercase font-bold tracking-widest mt-6">Volte no dia da sua escala oficial</p>
                        </div>
                    ) : user?.role !== 'admin' && minhasEscalasHoje.length > 0 && !minhasEscalasHoje.some(m => m.check_in_realizado) ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border border-dashed rounded-3xl text-center shadow-sm">
                            <AlertTriangle size={48} className="text-blue-500 mb-4" />
                            <h3 className="text-2xl font-black mb-2 text-foreground">Check-in Pendente</h3>
                            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                                Você está escalado hoje, mas ainda não se apresentou no templo para registrar sua chegada.
                            </p>
                            <div className="mt-8">
                                <a href="/escalas" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white truncate font-bold rounded-xl transition-all shadow-md mt-6">
                                    Ir para Escalas e Fazer Check-in
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-8">

                            {/* Departamentos / Abas */}
                            <div className="w-full md:w-64 shrink-0 space-y-2">
                                {/* Filtro Inteligente: O Voluntário SEMPRE vê apenas a guia do Depto dele. Tira opções que ele n deve clicar */}
                                {departamentos
                                    .filter(dep => user?.role === 'admin' ? true : minhasEscalasHoje.map(me => me.departamento_id).includes(dep.id))
                                    .map((dep) => (
                                        <button
                                            key={dep.id}
                                            onClick={() => handleTabChange(dep.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-4 rounded-2xl transition-all border font-bold capitalize",
                                                activeDepId === dep.id
                                                    ? "bg-blue-600/10 border-blue-500/30 text-blue-500 shadow-sm"
                                                    : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                {getDynamicIcon(dep.nome)} {dep.nome}
                                            </div>
                                            {activeDepId === dep.id && <ChevronRight size={16} />}
                                        </button>
                                    ))}

                                {departamentos.length === 0 && (
                                    <div className="p-4 text-center text-sm text-muted-foreground bg-accent/30 rounded-2xl border border-dashed border-border">
                                        Nenhum departamento criado. <br />Admins podem configurar.
                                    </div>
                                )}

                                <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                                    <h4 className="text-sm font-bold text-yellow-500 mb-2 flex items-center gap-2">
                                        <AlertTriangle size={16} /> XP Diário
                                    </h4>
                                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                        A submissão correta do checklist da sua área gera XP e impacta no ranking e patentes. Envie somente 1x por dia.
                                    </p>
                                </div>
                            </div>

                            {/* Itens do Checklist Content */}
                            <div className="flex-1 bg-card border border-border rounded-3xl p-6 lg:p-8 shadow-sm">
                                {activeDep ? (
                                    <>
                                        <div className="mb-6 pb-6 border-b border-border flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                                                {getDynamicIcon(activeDep.nome, 24)}
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-black capitalize">Dep. {activeDep.nome}</h2>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <p className="text-muted-foreground text-sm font-medium">Assinale as orientações de infraestrutura</p>
                                                    <div className="flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-accent text-foreground">
                                                        {checkedCount}/{activeItems.length} Feitos
                                                    </div>
                                                    <div className={cn("font-bold flex items-center gap-1 text-[11px] uppercase bg-background border px-2 py-0.5 rounded", isAllChecked && activeItems.length > 0 ? "text-green-500 border-green-500/20" : "text-yellow-500 border-yellow-500/20")}>
                                                        {isAllChecked && activeItems.length > 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                                        {isAllChecked && activeItems.length > 0 ? "Finalizad." : "Incompleto"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {activeItems.length === 0 ? (
                                                <div className="p-8 text-center bg-accent/10 border border-dashed border-border rounded-2xl text-muted-foreground font-medium">
                                                    Este departamento ainda não possui itens de verificação.
                                                </div>
                                            ) : (
                                                activeItems.map((item) => (
                                                    <label
                                                        key={item.id}
                                                        htmlFor={`chk - ${item.id} `}
                                                        className={cn(
                                                            "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group select-none",
                                                            item.check
                                                                ? "bg-green-500/5 border-green-500/30"
                                                                : "bg-background border-border hover:border-blue-500/30 hover:bg-blue-500/5",
                                                            isFinished && "opacity-60 cursor-not-allowed pointer-events-none"
                                                        )}
                                                    >
                                                        <div className="relative flex items-center justify-center shrink-0">
                                                            <input
                                                                type="checkbox"
                                                                id={`chk - ${item.id} `}
                                                                className="peer sr-only"
                                                                checked={item.check}
                                                                onChange={() => handleToggleCheck(item.id)}
                                                                disabled={isFinished}
                                                            />
                                                            <div className={cn(
                                                                "w-6 h-6 rounded border flex items-center justify-center transition-all",
                                                                item.check
                                                                    ? "bg-green-500 border-green-500"
                                                                    : "border-muted-foreground/40 peer-focus:ring-2 peer-focus:ring-blue-500 group-hover:border-blue-500"
                                                            )}>
                                                                {item.check && <CheckCircle2 size={16} className="text-white" />}
                                                            </div>
                                                        </div>
                                                        <span className={cn(
                                                            "font-bold text-sm transition-all flex-1 leading-snug",
                                                            item.check ? "text-green-500" : "text-foreground group-hover:text-blue-500"
                                                        )}>
                                                            {item.texto}
                                                        </span>
                                                    </label>
                                                ))
                                            )}
                                        </div>

                                        {/* CAIXA DE OBSERVAÇÃO/ORIENTAÇÃO PARA O DIA - ABAIXO DOS CHECKLISTS ANTES DE ENVIAR */}
                                        {escalaAtiva?.orientacao && (
                                            <div className="mt-6 mb-2 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-4 animate-in fade-in slide-in-from-top-4">
                                                <div className="shrink-0 mt-0.5"><div className="w-2 h-2 rounded-full bg-blue-500 animate-ping absolute"></div><div className="w-2 h-2 rounded-full bg-blue-500 relative"></div></div>
                                                <div>
                                                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">OBSERVAÇÃO DA LIDERANÇA ({escalaAtiva.escala_titulo})</h4>
                                                    <p className="text-sm font-medium text-foreground italic">"{escalaAtiva.orientacao}"</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-8 pt-6 border-t border-border flex justify-end">
                                            <button
                                                onClick={handleFinalizarProtocolo}
                                                disabled={!isAllChecked || isFinished || isSaving || activeItems.length === 0}
                                                className={cn(
                                                    "px-8 py-3.5 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2",
                                                    isAllChecked && !isFinished && activeItems.length > 0
                                                        ? "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                                                        : "bg-muted-foreground/30 shadow-none cursor-not-allowed",
                                                    isFinished && "bg-green-600 text-white shadow-green-600/20"
                                                )}>
                                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                                                {isFinished ? "Protocolo Enviado Hoje" : isSaving ? "Gravando XP..." : "Finalizar (Ganhar XP)"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-12 text-center text-muted-foreground">
                                        Selecione um departamento na lateral.
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </>
            )}

            {/* MODAL CONFIGURAÇÃO ADMIN */}
            {isEditModalOpen && user?.role === 'admin' && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-border flex flex-col">

                        {/* Header Modal */}
                        <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-card z-10 rounded-t-3xl">
                            <div>
                                <h3 className="text-xl font-black">Gerenciar Departamentos & Checklists</h3>
                                <p className="text-sm text-muted-foreground">Adicione áreas da mídia e customiza o formulário logístico.</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-accent rounded-full text-muted-foreground transition"><X size={20} /></button>
                        </div>

                        {/* Corpo Modal */}
                        <div className="p-6 space-y-8">

                            {/* Sessão 1: Departamentos */}
                            <div className="space-y-4 border-b border-border pb-8">
                                <h4 className="font-bold text-foreground flex items-center gap-2"><Settings2 size={18} className="text-blue-500" /> Criar Departamentos de Check</h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ex: Transmissão, Recepção, Som..."
                                        value={newDepName}
                                        onChange={e => setNewDepName(e.target.value)}
                                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    />
                                    <button onClick={handleCreateDep} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2">
                                        <Plus size={16} /> Adicionar
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-4">
                                    {departamentos.map(d => (
                                        <div key={d.id} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-sm select-none", editingDep?.id === d.id ? "bg-blue-500/10 border-blue-500/30 text-blue-500" : "bg-card border-border text-foreground")}>
                                            <span className="capitalize cursor-pointer hover:underline" onClick={() => setEditingDep(d)}>{getDynamicIcon(d.nome, 14)} {d.nome}</span>
                                            <button onClick={() => handleDeleteDep(d.id)} className="text-red-500/50 hover:text-red-500 transition ml-2"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">Clique no nome de um departamento acima para editar seus itens de inspeção abaixo.</p>
                            </div>

                            {/* Sessão 2: Itens do Departamento (Selecione um) */}
                            {editingDep ? (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-foreground capitalize flex items-center gap-2">
                                        Perguntas para: <span className="text-blue-500">{editingDep.nome}</span>
                                    </h4>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Ex: Ligar os 2 microfones na mesa..."
                                            value={newItemText}
                                            onChange={e => setNewItemText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreateItem(editingDep.id)}
                                            className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                        />
                                        <button onClick={() => handleCreateItem(editingDep.id)} className="bg-foreground hover:bg-muted-foreground text-background px-4 py-2 rounded-xl font-bold text-sm shadow-sm">
                                            Adicionar Item
                                        </button>
                                    </div>

                                    <div className="space-y-2 mt-4 bg-accent/20 p-4 rounded-2xl border border-border">
                                        {itens.filter(i => i.departamento_id === editingDep.id).map(item => (
                                            <div key={item.id} className="flex items-center justify-between bg-card border border-border p-3 rounded-xl">
                                                <span className="text-sm font-medium">{item.texto}</span>
                                                <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                        {itens.filter(i => i.departamento_id === editingDep.id).length === 0 && (
                                            <div className="text-center text-sm text-muted-foreground py-2">Sem tarefas ainda. Adicione a primeira acima.</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-8 bg-accent/20 border border-dashed border-border rounded-2xl text-muted-foreground font-medium flex flex-col items-center gap-2">
                                    <Lightbulb size={24} className="opacity-50" />
                                    Selecione (clique) em um departamento acima para adicionar itens de checklist dentro dele.
                                </div>
                            )}

                        </div>

                        <div className="p-4 bg-accent/30 border-t border-border flex justify-end">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">Concluído</button>
                        </div>

                    </div>
                </div>
            )}



            {levelUpData && (
                <LevelUpModal
                    isOpen={!!levelUpData}
                    onClose={() => setLevelUpData(null)}
                    oldElo={levelUpData.oldElo}
                    newElo={levelUpData.newElo}
                />
            )}

        </div>
    );
}
