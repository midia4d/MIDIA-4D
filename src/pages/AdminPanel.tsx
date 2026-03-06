import { ShieldAlert, Users, CalendarDays, ArrowUpRight, Search, CheckCircle, TrendingDown, TrendingUp, AlertOctagon, Star, ThumbsDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function AdminPanel() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);

    // Insights Pastorais
    const [voluntariosFaltosos, setVoluntariosFaltosos] = useState<any[]>([]);
    const [voluntariosEngajados, setVoluntariosEngajados] = useState<any[]>([]);

    // Modal de Usuário
    const [selectedUser, setSelectedUser] = useState<any | null>(null);

    // Tip / Gorjeta Modal State (Dentro do Admin Panel)
    const [tipModalOpen, setTipModalOpen] = useState(false);
    const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
    const [tipReason, setTipReason] = useState('');
    const [isSendingTip, setIsSendingTip] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAdminData = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                let isAdmin = profile?.role === 'admin';
                if (session.user.email && session.user.email.toLowerCase() === 'ieqceuazulpatos@gmail.com') {
                    isAdmin = true;
                }

                if (!isAdmin) {
                    navigate('/');
                    return;
                }

                // Busca dados Globais da equipe
                const [{ data: perfis }, { data: histEquipe }] = await Promise.all([
                    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                    supabase.from('escala_equipe').select('membro_id, status')
                ]);

                if (perfis && histEquipe) {
                    const stats = perfis.map(p => {
                        const missoes = histEquipe.filter(h => h.membro_id === p.id);
                        const faltas = missoes.filter(h => h.status === 'recusado').length;
                        const presencas = missoes.filter(h => h.status === 'confirmado').length;
                        return { ...p, faltas, presencas, total_escalas: missoes.length };
                    });

                    setUsers(stats); // Armazena os usuários JÁ com as estatísticas embutidas

                    const faltosos = [...stats].filter(s => s.faltas > 0).sort((a, b) => b.faltas - a.faltas).slice(0, 5);
                    const engajados = [...stats].filter(s => s.presencas > 0).sort((a, b) => b.presencas - a.presencas).slice(0, 5);

                    setVoluntariosFaltosos(faltosos);
                    setVoluntariosEngajados(engajados);
                } else {
                    setUsers(perfis || []);
                }

            } else {
                navigate('/login');
            }
            setLoading(false);
        };

        fetchAdminData();
    }, [navigate]);

    if (loading) {
        return <div className="p-12 text-center text-muted-foreground">Carregando Raio-X Pastoral...</div>;
    }

    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const handleSendTip = async (amount: number) => {
        if (!selectedUser) return;
        setIsSendingTip(true);

        try {
            // 1. Pega XP Atual garantido
            const { data: profile } = await supabase.from('profiles').select('xp').eq('id', selectedUser.id).single();
            const currentXp = profile?.xp || 0;

            // 2. Adiciona o XP Corrente + Bônus
            await supabase.from('profiles').update({ xp: currentXp + amount }).eq('id', selectedUser.id);

            // 3. Envia Notificação Push para pular na tela dele
            const msgMotivo = tipReason.trim() ? `Motivo: ${tipReason}` : `Reconhecimento pelo seu excelente serviço!`;
            await supabase.from('notificacoes').insert({
                membro_id: selectedUser.id,
                titulo: '🎁 Bônus de Liderança Recebido!',
                mensagem: `Você recebeu +${amount} XP do Admin. ${msgMotivo}`,
                tipo: 'conquista'
            });

            alert(`Gorjeta de +${amount} XP enviada com sucesso para ${selectedUser.nome}!`);

            // Atualiza localmente para ver refletido no Cartão na hora
            setSelectedUser({ ...selectedUser, xp: currentXp + amount });
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, xp: currentXp + amount } : u));

            setTipModalOpen(false);
            setTipReason('');

        } catch (error) {
            console.error("Erro ao enviar tip", error);
            alert("Erro ao enviar o Bônus.");
        } finally {
            setIsSendingTip(false);
        }
    };

    const handleRemoveTip = async (amount: number) => {
        if (!selectedUser) return;
        setIsSendingTip(true);

        try {
            // 1. Pega XP Atual garantido
            const { data: profile } = await supabase.from('profiles').select('xp').eq('id', selectedUser.id).single();
            const currentXp = profile?.xp || 0;

            // 2. Subtrai garantindo que o XP não fique negativo
            const newXp = Math.max(0, currentXp - amount);

            await supabase.from('profiles').update({ xp: newXp }).eq('id', selectedUser.id);

            // 3. Envia Notificação Push de Alerta para pular na tela dele
            const msgMotivo = tipReason.trim() ? `Motivo: ${tipReason}` : `Remoção manual por conduta inadequada na Liderança.`;
            await supabase.from('notificacoes').insert({
                membro_id: selectedUser.id,
                titulo: '⚠️ Penalidade de XP Aplicada',
                mensagem: `Você perdeu -${amount} XP. ${msgMotivo}`,
                tipo: 'warning'
            });

            alert(`Penalidade de -${amount} XP aplicada com sucesso para ${selectedUser.nome}.`);

            // Atualiza localmente
            setSelectedUser({ ...selectedUser, xp: newXp });
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, xp: newXp } : u));

            setPenaltyModalOpen(false);
            setTipReason('');

        } catch (error) {
            console.error("Erro ao aplicar penalidade", error);
            alert("Erro ao aplicar a Penalidade.");
        } finally {
            setIsSendingTip(false);
        }
    };

    // Removemos os handlers de edição de código de igreja pois agora o SaaS é single-tenant para a congregação mãe
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

            {/* Modal de Perfil do Voluntário */}
            {selectedUser && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border overflow-hidden transform scale-100 transition-transform">
                        <div className="bg-indigo-600 p-8 flex items-center gap-5 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center font-black text-3xl border-4 border-white/30 shadow-inner z-10 shrink-0">
                                {getInitials(selectedUser.nome)}
                            </div>
                            <div className="z-10">
                                <h3 className="font-extrabold text-2xl leading-tight">{selectedUser.nome}</h3>
                                <p className="text-indigo-200 text-sm font-medium mt-1">{selectedUser.funcao_principal || 'Voluntário'}</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Badges e XP */}
                            <div className="flex gap-3">
                                <div className="flex-1 bg-accent/30 border border-border rounded-2xl p-4 text-center">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">XP Total</div>
                                    <div className="font-black text-2xl text-blue-500">{selectedUser.xp || 0}</div>
                                </div>
                                <div className="flex-1 bg-accent/30 border border-border rounded-2xl p-4 text-center">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Patente</div>
                                    <div className={cn(
                                        "font-black text-2xl",
                                        selectedUser.nivel === 'Diamante' ? "text-cyan-500" :
                                            selectedUser.nivel === 'Ouro' ? "text-yellow-500" :
                                                selectedUser.nivel === 'Prata' ? "text-slate-400" :
                                                    "text-orange-500"
                                    )}>
                                        {selectedUser.nivel || 'Bronze'}
                                    </div>
                                </div>
                            </div>

                            {/* Stats Raio-X */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-3 ml-1">Desempenho em Escalas</h4>

                                <div className="flex items-center justify-between p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-600 shadow-sm">
                                    <div className="flex items-center gap-3 font-bold"><CheckCircle size={20} /> Presenças Confirmadas</div>
                                    <div className="font-black text-xl">{selectedUser.presencas || 0}</div>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 shadow-sm">
                                    <div className="flex items-center gap-3 font-bold"><AlertOctagon size={20} /> Faltas / Recusadas</div>
                                    <div className="font-black text-xl">{selectedUser.faltas || 0}</div>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-2xl bg-accent/50 border border-border text-foreground shadow-sm">
                                    <div className="flex items-center gap-3 font-bold text-sm"><CalendarDays size={20} className="text-muted-foreground" /> Total de Escalas Vinculadas</div>
                                    <div className="font-black text-lg">{selectedUser.total_escalas || 0}</div>
                                </div>
                            </div>

                            {/* Botões de Gamificação Globais */}
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button
                                    onClick={() => setTipModalOpen(true)}
                                    className="flex items-center justify-center gap-2 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 border border-yellow-500/30 font-bold rounded-2xl transition-colors shadow-sm"
                                >
                                    <Star size={16} className="fill-current" />
                                    Dar Bônus
                                </button>
                                <button
                                    onClick={() => setPenaltyModalOpen(true)}
                                    className="flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30 font-bold rounded-2xl transition-colors shadow-sm"
                                >
                                    <ThumbsDown size={16} />
                                    Remover XP
                                </button>
                            </div>
                        </div>

                        <div className="p-5 border-t border-border bg-accent/10 flex gap-3">
                            <button onClick={() => setSelectedUser(null)} className="flex-1 py-3.5 bg-card border border-border text-foreground font-bold rounded-xl hover:bg-accent transition-colors shadow-sm">Fechar</button>
                            {selectedUser.telefone && (
                                <a href={`https://wa.me/${selectedUser.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-500 transition-colors text-center flex items-center justify-center gap-2">WhatsApp Geral</a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Modal de Gorjetas (TIPS) - Renderizado sobre o Modal do Usuário */}
            {tipModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95">

                        <div className="p-6 border-b border-border text-center bg-gradient-to-b from-yellow-500/10 to-transparent">
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-400 to-amber-600 text-white rounded-full flex items-center justify-center mb-4 shadow-xl shadow-yellow-500/20">
                                <Star size={32} className="fill-current" />
                            </div>
                            <h3 className="text-xl font-black">Reconhecer Esforço</h3>
                            <p className="text-sm text-muted-foreground mt-1">Enviar XP extra para <strong className="text-foreground">{selectedUser.nome}</strong></p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Mensagem de Elogio (Opcional)</label>
                                <textarea
                                    value={tipReason}
                                    onChange={(e) => setTipReason(e.target.value)}
                                    placeholder="Ex: Mandou super bem nos cortes de câmera hoje!"
                                    className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-yellow-500 outline-none resize-none h-20"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <button disabled={isSendingTip} onClick={() => handleSendTip(10)} className="flex flex-col items-center gap-2 p-3 bg-card border border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 rounded-2xl transition group">
                                    <Star size={24} className="text-orange-400 fill-current opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                                    <span className="font-black text-foreground">+10</span>
                                </button>
                                <button disabled={isSendingTip} onClick={() => handleSendTip(30)} className="flex flex-col items-center gap-2 p-3 bg-card border border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 rounded-2xl transition group">
                                    <Star size={24} className="text-slate-300 fill-current opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                                    <span className="font-black text-foreground">+30</span>
                                </button>
                                <button disabled={isSendingTip} onClick={() => handleSendTip(50)} className="flex flex-col items-center gap-2 p-3 bg-card border border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 rounded-2xl transition group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent pointer-events-none" />
                                    <Star size={24} className="text-yellow-400 fill-current opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                                    <span className="font-black text-foreground">+50</span>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-accent/30 flex justify-end shrink-0">
                            <button disabled={isSendingTip} onClick={() => { setTipModalOpen(false); setTipReason(''); }} className="px-6 py-2 text-muted-foreground hover:text-foreground font-bold text-sm">Cancelar / Voltar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Modal de Penalidade (Tirar Pontos) - Renderizado sobre o Modal do Usuário */}
            {penaltyModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl border border-red-500/30 flex flex-col animate-in zoom-in-95">

                        <div className="p-6 border-b border-border text-center bg-gradient-to-b from-red-500/10 to-transparent">
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-red-500 to-rose-700 text-white rounded-full flex items-center justify-center mb-4 shadow-xl shadow-red-500/20">
                                <ThumbsDown size={28} className="fill-current" />
                            </div>
                            <h3 className="text-xl font-black text-red-500">Aplicar Penalidade</h3>
                            <p className="text-sm text-muted-foreground mt-1">Retirar XP de <strong className="text-foreground">{selectedUser.nome}</strong></p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Motivo da Penalidade (Obrigatório)</label>
                                <textarea
                                    value={tipReason}
                                    onChange={(e) => setTipReason(e.target.value)}
                                    placeholder="Ex: Faltou sem avisar / Postura inadequada no culto"
                                    className="w-full bg-background border border-red-500/30 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none h-20 placeholder:text-red-500/30"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <button disabled={isSendingTip || tipReason.length < 3} onClick={() => handleRemoveTip(10)} className="flex flex-col items-center gap-2 p-3 bg-red-50/50 dark:bg-red-500/5 hover:bg-red-100 dark:hover:bg-red-500/10 border border-red-500/20 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed group">
                                    <span className="font-black text-red-500 text-lg">-10</span>
                                    <span className="text-[10px] font-bold text-red-500/70 uppercase">Leve</span>
                                </button>
                                <button disabled={isSendingTip || tipReason.length < 3} onClick={() => handleRemoveTip(30)} className="flex flex-col items-center gap-2 p-3 bg-red-50/50 dark:bg-red-500/5 hover:bg-red-100 dark:hover:bg-red-500/10 border border-red-500/20 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed group">
                                    <span className="font-black text-red-500 text-lg">-30</span>
                                    <span className="text-[10px] font-bold text-red-500/70 uppercase">Média</span>
                                </button>
                                <button disabled={isSendingTip || tipReason.length < 3} onClick={() => handleRemoveTip(50)} className="flex flex-col items-center gap-2 p-3 bg-red-50/50 dark:bg-red-500/5 hover:bg-red-100 dark:hover:bg-red-500/10 border border-red-500/50 rounded-2xl transition relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-red-500/10 to-transparent pointer-events-none" />
                                    <span className="font-black text-red-600 text-lg">-50</span>
                                    <span className="text-[10px] font-bold text-red-600/70 uppercase">Grave</span>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-accent/30 flex justify-end shrink-0">
                            <button disabled={isSendingTip} onClick={() => { setPenaltyModalOpen(false); setTipReason(''); }} className="px-6 py-2 text-muted-foreground hover:text-foreground font-bold text-sm">Cancelar / Voltar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Admin */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-indigo-600/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm shadow-inner">
                            <ShieldAlert size={24} />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Raio-X Pastoral</h1>
                    </div>
                    <p className="text-indigo-100 font-medium max-w-lg">Visão estratégica da equipe. Acompanhe a saúde espiritual e o engajamento dos voluntários na operação dos cultos.</p>
                </div>

                <button
                    onClick={() => navigate('/escalas')}
                    className="relative z-10 bg-white text-indigo-600 px-6 py-3 rounded-xl font-extrabold shadow-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <CalendarDays size={18} /> Ver Escalas
                </button>
            </div>

            {/* Painel de Configurações Removido por ser Single-Tenant */}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start gap-4 hover:border-blue-500/30 transition-colors">
                    <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Efetivo de Mídia</div>
                        <div className="text-3xl font-black">{users.length} <span className="text-sm font-medium text-muted-foreground lowercase">voluntários</span></div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start gap-4 hover:border-green-500/30 transition-colors">
                    <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center shrink-0">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Engajamento Médio</div>
                        <div className="text-3xl font-black">
                            {users.length > 0 ? Math.round((voluntariosEngajados.reduce((acc, curr) => acc + curr.presencas, 0) / (users.length || 1))) : 0}
                            <span className="text-sm font-medium text-muted-foreground lowercase"> presenças/pessoa</span>
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-start gap-4 hover:border-red-500/30 transition-colors">
                    <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center shrink-0">
                        <AlertOctagon size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Risco de Evasão</div>
                        <div className="text-3xl font-black text-red-500">
                            {voluntariosFaltosos.length} <span className="text-sm font-medium text-muted-foreground lowercase text-red-400">alertas ativos</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Attention Needed (Faltosos) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <TrendingDown className="text-red-500" /> Ausências e Desistências
                        </h2>
                    </div>
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
                        {voluntariosFaltosos.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm flex-1 flex items-center justify-center flex-col gap-2">
                                <CheckCircle className="text-green-500 opacity-50" size={32} />
                                Nossa equipe é 100% comprometida! Nenhuma falta detectada.
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1">
                                {voluntariosFaltosos.map((user, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-accent/40 transition-colors relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedUser(user)}>
                                            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-sm">
                                                {getInitials(user.nome)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm flex items-center gap-2 text-foreground hover:text-blue-500 transition-colors">
                                                    {user.nome || 'Sem nome'}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                                                    <span className="bg-red-500/10 text-red-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]">
                                                        {user.faltas} Faltas
                                                    </span>
                                                    <span>Última função: {user.funcao_principal}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedUser(user)} className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200">
                                            Pastorear
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="p-3 bg-red-50 border-t border-red-500/20 text-xs text-red-600 font-medium text-center bg-red-500/5">
                            Uma conversa no privado pode reconectar estes operadores.
                        </div>
                    </div>
                </div>

                {/* Highly Engaged (Destaques) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <TrendingUp className="text-green-500" /> Pilares da Equipe
                        </h2>
                    </div>
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
                        {voluntariosEngajados.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm flex-1 flex items-center justify-center flex-col gap-2">
                                Ninguém serviu na escala ainda. Comece a fechar as listas nos finais de semana!
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1">
                                {voluntariosEngajados.map((user, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => setSelectedUser(user)}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-sm">
                                                {getInitials(user.nome)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm flex items-center gap-2 text-foreground hover:text-blue-500 transition-colors">
                                                    {user.nome || 'Sem nome'}
                                                    {i === 0 && <span className="bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-black">MVP</span>}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {user.funcao_principal || 'Não definida'} • {user.nivel}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-green-500">{user.presencas}</div>
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Cultos</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="p-3 bg-red-50 border-t border-green-500/20 text-xs text-green-600 font-medium text-center bg-green-500/5">
                            Reconheça o esforço. Um elogio público muda o clima da equipe.
                        </div>
                    </div>
                </div>

            </div>

            {/* Todo o Efetivo (Catálogo Geral) */}
            <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users className="text-blue-500" /> Catálogo Prático
                    </h2>
                    <div className="relative flex items-center">
                        <Search size={16} className="absolute left-3 text-muted-foreground pointer-events-none" />
                        <input type="text" placeholder="Buscar operador..." className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm shadow-sm focus:border-blue-500 outline-none text-foreground" />
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    {users.map((user, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => setSelectedUser(user)}>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-muted-foreground text-xs uppercase">
                                    {getInitials(user.nome)}
                                </div>
                                <div className="w-32">
                                    <div className="font-bold text-sm text-foreground hover:text-blue-500 transition-colors">{user.nome || 'Sem nome'}</div>
                                    <div className="text-xs text-muted-foreground">{user.funcao_principal || 'Voluntário'}</div>
                                </div>

                                {/* Status Chips (Desktop only) */}
                                <div className="hidden md:flex gap-2 min-w-[200px]">
                                    <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">
                                        XP: {user.xp || 0}
                                    </span>
                                    <span className={cn(
                                        "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                                        user.nivel === 'Diamante' ? "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" :
                                            user.nivel === 'Ouro' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                                user.nivel === 'Prata' ? "bg-slate-400/10 text-slate-500 border-slate-400/20" :
                                                    "bg-orange-600/10 text-orange-700 border-orange-600/20"
                                    )}>
                                        {user.nivel || 'Bronze'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {user.role === 'admin' && (
                                    <span className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded">
                                        <ShieldAlert size={12} /> Admin
                                    </span>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }} className="p-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors">
                                    <ArrowUpRight size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
