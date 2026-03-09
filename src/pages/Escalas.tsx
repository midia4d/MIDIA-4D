import { useState, useEffect } from 'react';
import { Users, Plus, Calendar as CalendarIcon, Clock, Clapperboard, Trash2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getElo, type EloConfig } from '../lib/gamification';
import { LevelUpModal } from '../components/LevelUpModal';

export default function Escalas() {
    const { user } = useOutletContext<{ user: any }>();
    const [activeTab, setActiveTab] = useState<'ativas' | 'historico'>('ativas');

    // Estado do Banco de Dados
    const [escalasAtivas, setEscalasAtivas] = useState<any[]>([]);
    const [membros, setMembros] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Estado do Pop-up (Nova Escala)
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ titulo: '', data: '', horario: '' });

    // Estado do Pop-up (Editar Escala)
    const [showEditModal, setShowEditModal] = useState<{ show: boolean, escalaId: string | null }>({ show: false, escalaId: null });
    const [editFormData, setEditFormData] = useState({ titulo: '', data: '', horario: '' });

    // Estado do Pop-up (Adicionar Função)
    const [showAdictModal, setShowAdictModal] = useState<{ show: boolean, escalaId: string | null }>({ show: false, escalaId: null });
    const [funcaoFormData, setFuncaoFormData] = useState({ funcao: '', membroId: '', departamentoId: '', orientacao: '' });

    // Departamentos para o Select
    const [departamentos, setDepartamentos] = useState<any[]>([]);

    // Evento Premium Gamificação
    const [levelUpData, setLevelUpData] = useState<{ oldElo: EloConfig, newElo: EloConfig } | null>(null);

    // Buscar Todos Dados Iniciais
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            setIsLoadingData(true);

            // Fetch paralelo: Não bloqueia uma query pela outra para renderizar mais rápido
            const [resEscalas, resMembros, resDeps] = await Promise.all([
                supabase
                    .from('escalas')
                    .select(`
                        id, titulo, data_horario, created_at,
                        escala_equipe ( id, funcao, membro_id, status, justificativa, orientacao, departamento_id, check_in_realizado, xp_ganho, checklist_departamentos(nome) )
                    `)
                    .order('data_horario', { ascending: true }),
                supabase
                    .from('profiles')
                    .select(`
                        id, nome, disponibilidade ( data_disponivel )
                    `)
                    .order('nome', { ascending: true }),
                supabase
                    .from('checklist_departamentos')
                    .select('id, nome')
                    .order('ordem', { ascending: true })
            ]);

            if (isMounted) {
                if (resEscalas.data) {
                    const formatted = resEscalas.data.map(esc => {
                        const dateObj = new Date(esc.data_horario);
                        return {
                            id: esc.id,
                            titulo: esc.titulo,
                            data: dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }),
                            horario: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                            equipe: esc.escala_equipe || [],
                            raw_data_horario: esc.data_horario
                        };
                    });
                    setEscalasAtivas(formatted);
                }

                if (resMembros.data) {
                    setMembros(resMembros.data);
                }

                if (resDeps.data) {
                    setDepartamentos(resDeps.data);
                }

                setIsLoadingData(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, []);

    // Apenas Fetch Escalas isolado (para re-updates no Add Modal)
    const fetchEscalas = async () => {
        const { data } = await supabase
            .from('escalas')
            .select(`
                id, titulo, data_horario, created_at,
                escala_equipe ( id, funcao, membro_id, status, justificativa, orientacao, departamento_id, check_in_realizado, xp_ganho, checklist_departamentos(nome) )
            `)
            .order('data_horario', { ascending: true });

        if (data) {
            const formatted = data.map(esc => {
                const dateObj = new Date(esc.data_horario);
                return {
                    id: esc.id,
                    titulo: esc.titulo,
                    data: dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }),
                    horario: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    equipe: esc.escala_equipe || [],
                    raw_data_horario: esc.data_horario
                };
            });
            setEscalasAtivas(formatted);
        }
    };

    // Criar Nova Escala
    const handleAddEscala = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.titulo || !formData.data || !formData.horario) return;

        setIsSaving(true);
        try {
            // Juntar data e hora para salvar no formato TIMESTAMP do Postgres
            const datetimeInput = `${formData.data}T${formData.horario}:00`;
            const dataHorario = new Date(datetimeInput).toISOString();

            const { error } = await supabase
                .from('escalas')
                .insert([
                    {
                        titulo: formData.titulo,
                        data_horario: dataHorario,
                        created_by: user.id
                    }
                ]);

            if (error) throw error;

            await fetchEscalas(); // Recarregar
            setShowModal(false);
            setFormData({ titulo: '', data: '', horario: '' });
        } catch (error: any) {
            console.error("Erro ao salvar escala:", error);
            alert(`Erro do Banco de Dados: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Editar Escala Existente
    const handleEditEscala = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showEditModal.escalaId || !editFormData.titulo || !editFormData.data || !editFormData.horario) return;

        setIsSaving(true);
        try {
            // Juntar data e hora para salvar no formato TIMESTAMP do Postgres
            const datetimeInput = `${editFormData.data}T${editFormData.horario}:00`;
            const dataHorario = new Date(datetimeInput).toISOString();

            const { error } = await supabase
                .from('escalas')
                .update({
                    titulo: editFormData.titulo,
                    data_horario: dataHorario
                })
                .eq('id', showEditModal.escalaId);

            if (error) throw error;

            await fetchEscalas(); // Recarregar
            setShowEditModal({ show: false, escalaId: null });
            setEditFormData({ titulo: '', data: '', horario: '' });
        } catch (error: any) {
            console.error("Erro ao editar escala:", error);
            alert(`Erro do Banco de Dados: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Adicionar Função na Escala
    const handleAddFuncao = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showAdictModal.escalaId || !funcaoFormData.funcao || !funcaoFormData.membroId) return;

        setIsSaving(true);
        try {
            const payload: any = {
                escala_id: showAdictModal.escalaId,
                funcao: funcaoFormData.funcao,
                membro_id: funcaoFormData.membroId,
                status: 'pendente'
            };

            if (funcaoFormData.departamentoId) {
                payload.departamento_id = funcaoFormData.departamentoId;
            }
            if (funcaoFormData.orientacao) {
                payload.orientacao = funcaoFormData.orientacao;
            }

            const { error } = await supabase
                .from('escala_equipe')
                .insert([payload]);

            if (error) throw error;

            // Enviar Notificação para o Voluntário!
            const escalaAberta = escalasAtivas.find(e => e.id === showAdictModal.escalaId);
            if (escalaAberta) {
                await supabase.from('notificacoes').insert([{
                    usuario_id: funcaoFormData.membroId,
                    titulo: 'Nova Escala!',
                    mensagem: `Você foi escalado para '${escalaAberta.titulo}' na função de ${funcaoFormData.funcao}. Confira sua disponibilidade.`,
                    tipo: 'escala',
                    link: '/escalas'
                }]);
            }

            await fetchEscalas(); // Recarregar
            setShowAdictModal({ show: false, escalaId: null });
            setFuncaoFormData({ funcao: '', membroId: '', departamentoId: '', orientacao: '' });
        } catch (error) {
            console.error("Erro ao alocar membro:", error);
            alert("Não foi possível salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    // Botão de Lembrete: Notificar Toda a Equipe
    const handleNotifyAll = async (escala: any) => {
        if (!confirm(`Deseja enviar um alerta para todos os ${escala.equipe.length} voluntários desta escala? (Isso fará o sininho tocar no celular deles)`)) return;

        // Montar lote de notificações
        const notificacoes = escala.equipe
            .filter((slot: any) => slot.membro_id) // Apenas slots preenchidos
            .map((slot: any) => ({
                usuario_id: slot.membro_id,
                titulo: 'Atenção, Operadores! 🎬',
                mensagem: `Falta pouco para '${escala.titulo}'. Por favor, revise sua função, os checklists e o roteiro do culto.`,
                tipo: 'warning',
                link: '/checklists'
            }));

        if (notificacoes.length > 0) {
            try {
                const { error } = await supabase.from('notificacoes').insert(notificacoes);
                if (error) throw error;
                alert('Sinos tocados! A equipe inteira recebeu a notificação simultaneamente.');
            } catch (err) {
                console.error("Erro ao notificar grupo", err);
                alert("Erro ao notificar grupo. Tente novamente.");
            }
        } else {
            alert('Não há ninguém na equipe para notificar.');
        }
    };

    // Fazer Check-in do Voluntário (Com cálculo dinâmico de XP)
    const handleCheckin = async (escalaEquipeId: string, dataHorarioCultoStr: string, forceAdmin: boolean = false) => {
        if (forceAdmin && !confirm("Admin: Você está forçando o Check-in manual. O sistema dará pontuação Base de 50 XP para este voluntário pela tolerância manual.")) {
            return;
        }

        try {
            const now = new Date();
            const cultoDate = new Date(dataHorarioCultoStr);

            // Calcular diferença em minutos (Culto - Agora)
            const diffInMs = cultoDate.getTime() - now.getTime();
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

            let xpGanho = 30; // Atrasado (< 40min antes)
            let alertMsg: string | null = 'Check-in realizado! (XP Reduzido por atraso)';

            if (forceAdmin) {
                // Admin bypass (Padrão: 50XP)
                xpGanho = 50;
                alertMsg = 'Check-in forçado pelo Administrador! (50 XP)';
            } else if (diffInMinutes >= 60) {
                // Muito adiantado (Chegou 1h+ antes do culto)
                xpGanho = 70; // 50 Base + 20 Pontualidade Master
                alertMsg = 'BOOYAH! Check-in Master realizado (+70 XP)! Você é exemplo!';
            } else if (diffInMinutes >= 40) {
                // Em cima da hora, mas na tolerância de 20min da marca de 1h ("Na régua")
                xpGanho = 50; // 50 Base
                alertMsg = 'MANDOU BEM! Check-in realizado com sucesso (+50 XP)!';
            } else if (diffInMinutes > 0) {
                // Atrasado para o Mídia 4D, mas antes do culto começar (30XP)
                xpGanho = 30;
                alertMsg = 'Check-in realizado! Tente chegar um pouco mais cedo da próxima (+30 XP).';
            } else {
                // Fez depois que o culto começou
                xpGanho = 10;
                alertMsg = 'Check-in realizado durante o culto (+10 XP).';
            }

            const { error: scaleError } = await supabase
                .from('escala_equipe')
                .update({
                    check_in_realizado: now.toISOString(),
                    xp_ganho: xpGanho
                })
                .eq('id', escalaEquipeId);

            if (scaleError) throw scaleError;

            // Encontrar membro vinculado (para adicionar XP real ao perfil no Banco)
            // Lógica ideal seria Trigger, mas faremos no Front-End para agilidade como no checklist
            const slot = escalasAtivas.flatMap(e => e.equipe).find(s => s.id === escalaEquipeId);
            if (slot?.membro_id) {
                // 1. Pegar o Profile atual
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('xp')
                    .eq('id', slot.membro_id)
                    .single();

                // Decidir se subiu de Elo (apenas mostra pro dono da conta se auto-checar)
                const currentXp = profile?.xp || 0;
                const newXp = currentXp + xpGanho;

                await supabase.from('profiles').update({ xp: newXp }).eq('id', slot.membro_id);

                if (user?.id === slot.membro_id) {
                    const oldElo = getElo(currentXp);
                    const newElo = getElo(newXp);
                    if (newElo.name !== oldElo.name && newElo.minXp > oldElo.minXp) {
                        setLevelUpData({ oldElo, newElo });
                        alertMsg = null; // Silencia o alert padro pra explodir o modal na tela
                    }
                }
            }

            await fetchEscalas();
            if (!forceAdmin && alertMsg) alert(alertMsg);

        } catch (error: any) {
            console.error("Erro ao fazer check-in:", error);
            alert(`Falha no Check-in: ${error.message || JSON.stringify(error)}`);
        }
    };

    // Atualizar Status do Voluntário (Confirmar / Recusar)
    const handleUpdateStatus = async (escalaEquipeId: string, novoStatus: 'confirmado' | 'recusado') => {
        let textoJustificativa: string | null = null;

        if (novoStatus === 'recusado') {
            const promptTexto = prompt("Por favor, informe rapidamente o motivo da ausência para justificar aos líderes e liberar a vaga para cobertura:");
            if (promptTexto === null) return; // Se o usuário cancelar o prompt, aborta a ação
            textoJustificativa = promptTexto.trim() === '' ? 'Sem justificativa informada' : promptTexto;

            try {
                const { error } = await supabase.rpc('cancelar_escala_vaga', {
                    p_escala_equipe_id: escalaEquipeId,
                    p_justificativa: textoJustificativa
                });

                if (error) throw error;
                await fetchEscalas();
            } catch (error) {
                console.error("Erro ao cancelar vaga:", error);
                alert("Erro ao cancelar vaga e gerar cobertura. Tente novamente.");
            }
            return;
        }

        try {
            const { error } = await supabase
                .from('escala_equipe')
                .update({ status: novoStatus })
                .eq('id', escalaEquipeId);

            if (error) throw error;
            await fetchEscalas();
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar status. Tente novamente.");
        }
    };

    // Assumir Vaga Aberta (Cobertura)
    const handleAssumirVaga = async (escalaEquipeId: string) => {
        if (!confirm("Tem certeza que deseja assumir esta vaga de cobertura na equipe?")) return;
        try {
            const { error } = await supabase.rpc('assumir_vaga_escala', {
                p_escala_equipe_id: escalaEquipeId
            });
            if (error) throw error;
            await fetchEscalas();
            alert("Parabéns! Vaga assumida com sucesso. Você foi confirmado nesta escala.");
        } catch (error: any) {
            console.error("Erro ao assumir vaga:", error);
            alert(`Erro ao assumir vaga: ${error.message || 'Desconhecido'}`);
        }
    };

    // Deletar a Escala Inteira (Apenas Admin)
    const handleDeleteEscala = async (escalaId: string) => {
        if (!confirm("Tem certeza que deseja apagar essa escala? Todos os voluntários alocados a ela também serão removidos.")) return;

        try {
            const { error } = await supabase
                .from('escalas')
                .delete()
                .eq('id', escalaId);

            if (error) throw error;
            await fetchEscalas();
        } catch (error: any) {
            console.error("Erro ao excluir escala:", error);
            alert(`Erro do Banco de Dados: ${error.message || JSON.stringify(error)}`);
        }
    };

    // Deletar uma Função/Voluntário Específico da Escala
    const handleDeleteFuncao = async (escalaEquipeId: string) => {
        if (!confirm("Remover este voluntário da escala?")) return;

        try {
            const { error } = await supabase
                .from('escala_equipe')
                .delete()
                .eq('id', escalaEquipeId);

            if (error) throw error;
            await fetchEscalas();
        } catch (error: any) {
            console.error("Erro ao remover voluntário:", error);
            alert(`Erro do Banco de Dados: ${error.message || JSON.stringify(error)}`);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Escalas Oficiais</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Visualize as escalas, sua posição e confirme sua presença.</p>
                </div>

                {user?.role === 'admin' && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} /> Novo Culto
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-card p-1 rounded-xl border border-border w-max shadow-sm">
                <button
                    onClick={() => setActiveTab('ativas')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'ativas' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Próximas Escalas
                </button>
                <button
                    onClick={() => setActiveTab('historico')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'historico' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Histórico
                </button>
            </div>

            {/* Lista de Escalas ou Vazio */}
            {isLoadingData ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
            ) : escalasAtivas.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-card border border-border border-dashed rounded-3xl text-center">
                    <CalendarIcon size={48} className="text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Nenhuma escala programada</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mb-6">
                        {user?.role === 'admin'
                            ? "Não há escalas definidas para os próximos dias. Clique no botão acima para criar sua primeira escala oficial."
                            : "A coordenação ainda não liberou a escala deste fim de semana. Você será notificado quando for escalado."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {escalasAtivas.map((escala) => (
                        <div key={escala.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col hover:border-blue-500/30 transition-colors">

                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold capitalize">{escala.titulo}</h3>
                                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground font-medium">
                                        <span className="flex items-center gap-1.5 capitalize"><CalendarIcon size={16} /> {escala.data}</span>
                                        <span className="flex items-center gap-1.5"><Clock size={16} /> {escala.horario}</span>
                                    </div>
                                </div>
                                {user?.role === 'admin' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                // Preenche o modal de edição com os dados atuais baseados no raw
                                                const dt = new Date(escala.raw_data_horario);
                                                const yyyy = dt.getFullYear();
                                                const mm = String(dt.getMonth() + 1).padStart(2, '0');
                                                const dd = String(dt.getDate()).padStart(2, '0');
                                                const hh = String(dt.getHours()).padStart(2, '0');
                                                const min = String(dt.getMinutes()).padStart(2, '0');

                                                setEditFormData({
                                                    titulo: escala.titulo,
                                                    data: `${yyyy}-${mm}-${dd}`,
                                                    horario: `${hh}:${min}`
                                                });
                                                setShowEditModal({ show: true, escalaId: escala.id });
                                            }}
                                            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                                            title="Editar Escala"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEscala(escala.id)}
                                            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                            title="Apagar Escala Inteira"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 flex-1 mb-6">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Equipe Alocada</h4>
                                {escala.equipe.length === 0 ? (
                                    <div className="text-sm text-muted-foreground py-2 border-b border-border/50 italic">Ninguém escalado ainda.</div>
                                ) : (
                                    escala.equipe.map((slot: any, i: number) => (
                                        <div key={i} className={cn("flex flex-col p-3 rounded-xl border transition-colors cursor-pointer group", !slot.membro_id ? "bg-orange-500/10 border-orange-500/50 hover:bg-orange-500/20 shadow-sm shadow-orange-500/10" : "bg-background border-border hover:bg-accent/50")}>
                                            {/* Top Row: Avatar, Nome e Lixeira */}
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", !slot.membro_id ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "bg-blue-500/10 text-blue-500")}>
                                                        {slot.membro_id ? <Clapperboard size={14} /> : <Users size={14} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className={cn("font-bold text-base truncate flex items-center gap-2 flex-wrap", !slot.membro_id && "text-orange-500 text-lg")}>
                                                                {slot.membro_id ? (membros.find(m => m.id === slot.membro_id)?.nome || 'Voluntário') : '🚨 VAGA DE COBERTURA 🚨'}
                                                                {slot.status === 'confirmado' && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Confirmado</span>}
                                                                {slot.status === 'recusado' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">Ausente</span>}
                                                                {slot.status === 'pendente' && slot.membro_id && <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-bold">Pendente</span>}
                                                                {slot.check_in_realizado && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold text-nowrap flex items-center gap-1"><CheckCircle2 size={12} /> {new Date(slot.check_in_realizado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+{slot.xp_ganho}XP)</span>}
                                                            </p>
                                                        </div>
                                                        <p className="text-muted-foreground text-sm font-medium flex items-center gap-2 flex-wrap">
                                                            <span className="bg-accent px-2 py-0.5 rounded text-xs">{slot.funcao}</span>
                                                            {slot.checklist_departamentos?.nome && (
                                                                <span className="text-xs text-blue-400 flex items-center gap-1 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                                                    <Clapperboard size={10} /> {slot.checklist_departamentos.nome}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {slot.orientacao && (
                                                            <div className="mt-1 flex items-start gap-1 text-muted-foreground bg-accent px-2 py-1 rounded w-max text-xs max-w-[200px] sm:max-w-xs border border-border">
                                                                <strong className="block text-foreground shrink-0">Obs:</strong>
                                                                <span className="italic line-clamp-1 truncate">{slot.orientacao}</span>
                                                            </div>
                                                        )}
                                                        {slot.status === 'recusado' && slot.justificativa && (
                                                            <div className="mt-1 flex items-start gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded w-max text-xs max-w-[200px] sm:max-w-xs">
                                                                <strong className="block shrink-0">Motivo:</strong>
                                                                <span className="italic line-clamp-2">{slot.justificativa}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {user?.role === 'admin' && (
                                                    <button
                                                        onClick={() => handleDeleteFuncao(slot.id)}
                                                        className="p-1.5 text-muted-foreground hover:text-white transition-all bg-accent hover:bg-red-500 rounded-lg flex items-center gap-2 px-3 opacity-80 hover:opacity-100 ml-2 shrink-0 self-start mt-1"
                                                        title="Remover voluntário da escala"
                                                    >
                                                        <Trash2 size={14} /> <span className="text-[10px] uppercase font-bold hidden sm:inline">Excluir</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Ações do Voluntário ou do Admin (Forçar e Checkin) */}
                                            <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-border flex-wrap sm:flex-nowrap w-full">
                                                {/* VISÃO VOLUNTÁRIO DONO DO SLOT */}
                                                {user && slot.membro_id === user.id && !slot.check_in_realizado && slot.status !== 'recusado' ? (
                                                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                        {slot.status === 'pendente' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(slot.id, 'confirmado')}
                                                                    className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-emerald-600 transition-colors"
                                                                >
                                                                    Confirmar Presença
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(slot.id, 'recusado')}
                                                                    className="flex-1 bg-red-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-red-600 transition-colors"
                                                                >
                                                                    Não poderei ir
                                                                </button>
                                                            </>
                                                        )}
                                                        {slot.status === 'confirmado' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleCheckin(slot.id, escala.raw_data_horario)}
                                                                    className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(37,99,235,0.4)] animate-pulse"
                                                                >
                                                                    🔥 Fazer Check-in no Templo
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(slot.id, 'recusado')}
                                                                    className="px-4 bg-red-500/10 text-red-500 text-xs font-bold py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors border border-red-500/20"
                                                                    title="Desistir da Escala"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : !slot.membro_id ? (
                                                    <div className="flex-1 flex w-full">
                                                        <button
                                                            onClick={() => handleAssumirVaga(slot.id)}
                                                            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs font-black py-2.5 rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/20 uppercase tracking-wider flex items-center justify-center gap-2"
                                                        >
                                                            ✨ ME OFEREÇO PARA COBRIR
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex justify-between items-center text-xs font-medium text-muted-foreground sm:min-w-[150px]">
                                                        <span>Status Final:</span>
                                                        <span className="uppercase text-[10px] font-black">{slot.check_in_realizado ? 'PRESENÇA REGISTRADA' : slot.status}</span>
                                                    </div>
                                                )}

                                                {/* VISÃO ADMIN (FORÇAR CHECK-IN) */}
                                                {user?.role === 'admin' && slot.status === 'confirmado' && !slot.check_in_realizado && (
                                                    <button
                                                        onClick={() => handleCheckin(slot.id, escala.raw_data_horario, true)}
                                                        className="text-[10px] shrink-0 uppercase font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded hover:bg-yellow-500 hover:text-black transition-colors"
                                                        title="Forçar check-in manualmente se ele estiver sem celular"
                                                    >
                                                        Forçar Check-in
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}

                                {user?.role === 'admin' && (
                                    <button
                                        onClick={() => setShowAdictModal({ show: true, escalaId: escala.id })}
                                        className="w-full py-2.5 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors flex items-center justify-center gap-2 mt-2"
                                    >
                                        <Plus size={16} /> Adicionar Função
                                    </button>
                                )}
                            </div>

                            <div className="border-t border-border pt-4 mt-auto">
                                <div className="flex justify-between items-center bg-blue-500/10 text-blue-500 p-3 rounded-xl border border-blue-500/20">
                                    <div className="text-sm font-bold flex items-center gap-2">
                                        <Users size={16} /> {escala.equipe.filter((e: any) => e.status === 'confirmado').length} de {escala.equipe.length} confirmados
                                    </div>
                                    {user?.role === 'admin' ? (
                                        <button
                                            onClick={() => handleNotifyAll(escala)}
                                            className="text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                                        >
                                            Notificar Equipe
                                        </button>
                                    ) : (() => {
                                        // Verificar se o usuário está escalado neste evento
                                        const meuSlot = escala.equipe.find((e: any) => e.membro_id === user?.id);

                                        if (!meuSlot) {
                                            return <span className="text-sm font-bold text-muted-foreground">Não escalado</span>;
                                        }

                                        if (meuSlot.status === 'pendente') {
                                            return (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleUpdateStatus(meuSlot.id, 'recusado')} className="text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-lg transition-colors">
                                                        Justificar Falta
                                                    </button>
                                                    <button onClick={() => handleUpdateStatus(meuSlot.id, 'confirmado')} className="text-sm font-bold bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg shadow-sm transition-colors animate-pulse">
                                                        Confirmar
                                                    </button>
                                                </div>
                                            );
                                        }

                                        if (meuSlot.status === 'confirmado') {
                                            return <span className="text-sm font-bold text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg">Presença Confirmada</span>;
                                        }

                                        return <span className="text-sm font-bold text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg">Falta Justificada</span>;
                                    })()}
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Nova Escala */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl p-6 relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
                            <CalendarIcon className="text-blue-500" /> Nova Escala
                        </h2>

                        <form onSubmit={handleAddEscala} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">Título do Evento</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Culto da Família"
                                    value={formData.titulo}
                                    onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.data}
                                        onChange={e => setFormData({ ...formData, data: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Horário</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.horario}
                                        onChange={e => setFormData({ ...formData, horario: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                {isSaving ? "Criando Escala..." : "Criar Escala Oficial"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Editar Escala (Admin) */}
            {showEditModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl p-6 relative">
                        <button
                            onClick={() => setShowEditModal({ show: false, escalaId: null })}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg> Editar Escala
                        </h2>

                        <form onSubmit={handleEditEscala} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">Título do Evento</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Culto da Família"
                                    value={editFormData.titulo}
                                    onChange={e => setEditFormData({ ...editFormData, titulo: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        value={editFormData.data}
                                        onChange={e => setEditFormData({ ...editFormData, data: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Horário</label>
                                    <input
                                        type="time"
                                        required
                                        value={editFormData.horario}
                                        onChange={e => setEditFormData({ ...editFormData, horario: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                                {isSaving ? "Salvando..." : "Salvar Alterações"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar Função */}
            {showAdictModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl p-6 relative">
                        <button
                            onClick={() => setShowAdictModal({ show: false, escalaId: null })}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
                            <Users className="text-blue-500" /> Alocar Voluntário
                        </h2>

                        <form onSubmit={handleAddFuncao} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Qual a função?</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Câmera 1"
                                        value={funcaoFormData.funcao}
                                        onChange={e => setFuncaoFormData({ ...funcaoFormData, funcao: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Checklist Atrelado</label>
                                    <select
                                        value={funcaoFormData.departamentoId}
                                        onChange={e => setFuncaoFormData({ ...funcaoFormData, departamentoId: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm appearance-none"
                                    >
                                        <option value="">Nenhum Checklist</option>
                                        {departamentos.map(d => (
                                            <option key={d.id} value={d.id}>{d.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">Selecione o Voluntário</label>
                                <select
                                    required
                                    value={funcaoFormData.membroId}
                                    onChange={e => setFuncaoFormData({ ...funcaoFormData, membroId: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm appearance-none"
                                >
                                    <option value="" disabled>Escolha alguém da lista...</option>
                                    {(() => {
                                        // Pegar a data da escala selecionada para checar disponibilidade
                                        const escalaAberta = escalasAtivas.find(e => e.id === showAdictModal.escalaId);
                                        const dateDaEscala = escalaAberta ? escalaAberta.data : null; // Ex: '19 de fev.'

                                        return membros.map(membro => {
                                            // Checar se a data dessa escala (formatada na tela) se aproxima com a data do banco
                                            // Para simplicidade vamos formatar as datas de disponibilidade do usuário para o padrão visual
                                            const standsOut = membro.disponibilidade?.some((disp: any) => {
                                                const dispDateObj = new Date(disp.data_disponivel + "T00:00:00");
                                                const formatada = dispDateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
                                                return formatada === dateDaEscala;
                                            });

                                            return (
                                                <option key={membro.id} value={membro.id}>
                                                    {standsOut ? '✓ [DISPONÍVEL] ' : '× [Não listado] '}
                                                    {membro.nome}
                                                </option>
                                            );
                                        });
                                    })()}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">Orientação Especial (Opcional)</label>
                                <textarea
                                    placeholder="Ex: Focar mais no pastor hoje pois terá batismo..."
                                    value={funcaoFormData.orientacao}
                                    onChange={e => setFuncaoFormData({ ...funcaoFormData, orientacao: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm min-h-[80px]"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Essa mensagem aparecerá para ele(a) na tela de Checklists.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                                {isSaving ? "Alocando..." : "Salvar na Escala"}
                            </button>
                        </form>
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
