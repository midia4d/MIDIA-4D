import { ShieldCheck, Mail, Clapperboard, Award, Zap, Loader2, Target, Star, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getElo, getNextElo, ELOS_CONFIG } from '../lib/gamification';

export default function Profile() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                setUser({ ...session.user, ...data });
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
    }

    if (!user) {
        return <div className="p-12 flex justify-center text-muted-foreground">Usuário não autenticado.</div>;
    }

    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const currentElo = getElo(user?.xp || 0);
    const nextElo = getNextElo(user?.xp || 0);

    // Calc Progress
    const xpBase = nextElo ? ELOS_CONFIG.slice().reverse().find((e: any) => e.minXp <= (user?.xp || 0))?.minXp || 0 : 0;
    const progressPercent = nextElo ? Math.min(100, Math.max(0, ((user.xp - xpBase) / (nextElo.minXp - xpBase)) * 100)) : 100;

    const handleDeleteAccount = async () => {
        const confirmarRedZone = window.confirm("ATENÇÃO EXTREMA: Você está prestes a DELETAR permanentemente sua conta! Todo seu Histórico, Níveis Acadêmicos e Escalas serão perdidos para sempre.\n\nTem ABSOLUTA certeza de que deseja fazer isso?");

        if (!confirmarRedZone) return;

        setLoading(true);
        try {
            // Invoca a RPC de força-bruta bypassando RLS e atacando o auth.users direto
            const { error: rpcError } = await supabase.rpc('deletar_minha_conta');

            if (rpcError) {
                console.error("Erro na Database (RPC Deletar):", rpcError);
                throw new Error("Falha ao comunicar com o Banco de Dados. Detalhes: " + rpcError.message);
            }

            // Conta atomizada no backend! Limpa o Caches Local:
            await supabase.auth.signOut();

            alert("Conta encerrada com sucesso. Esperamos que você retorne um dia!");
            // Como a subscrição de auth está ativa no AppLayout, ao deslogar já serei chutado pro /login
            window.location.href = '/login';

        } catch (error: any) {
            alert(`Ops, ocorreu um bloqueio sistêmico: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                {/* Cover Banner */}
                <div className="h-40 w-full bg-gradient-to-r from-blue-900 to-indigo-900 relative">
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute -bottom-12 left-8 p-1.5 bg-card rounded-2xl">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-3xl font-black shadow-lg uppercase">
                            {user.avatar_url ? <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-lg object-cover" /> : getInitials(user.nome || user.email)}
                        </div>
                    </div>

                    <div className={`absolute top-4 right-4 bg-gradient-to-r ${currentElo.bg} ${currentElo.color} px-4 py-2 rounded-full backdrop-blur-md border ${currentElo.border} font-black text-sm flex items-center gap-2 shadow-lg`}>
                        <currentElo.icon size={16} className={currentElo.color} /> {currentElo.name}
                    </div>
                </div>

                {/* Profile Info */}
                <div className="pt-16 pb-8 px-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            {user.nome || 'Voluntário'}
                            <ShieldCheck className="text-blue-500" size={20} />
                        </h1>
                        <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                            <Mail size={14} /> {user.email}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <div className="bg-background border border-border px-4 py-3 rounded-xl text-center flex-1 min-w-[140px] relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col items-center justify-center">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">XP Atual</div>
                                <div className="text-xl font-black text-blue-500 flex items-center justify-center gap-1">
                                    <Zap size={18} className="fill-blue-500 flex-shrink-0" /> {user.xp || 0}
                                </div>
                                {nextElo && (
                                    <div className="w-full mt-3">
                                        <div className="flex justify-between text-[10px] text-muted-foreground font-bold mb-1 px-1">
                                            <span>Progresso</span>
                                            <span>{nextElo.minXp} XP</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${currentElo.color.replace('text-', 'from-')} to-blue-500 transition-all duration-1000 ease-out`}
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-background border border-border px-4 py-3 rounded-xl text-center flex flex-col items-center justify-center min-w-[100px]">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Rank Geral</div>
                            <div className="text-2xl font-black text-white flex items-center justify-center gap-1">
                                <Target size={16} className="text-muted-foreground" /> #?
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Skills/Levels (Domínio) */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Award className="text-blue-500" /> Níveis Técnicos
                    </h2>
                    <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold flex items-center gap-2">
                                    <Clapperboard size={16} className="text-muted-foreground" /> Câmera
                                </span>
                                <span className="text-sm font-bold text-blue-500">Nível 3 (Master)</span>
                            </div>
                            <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-full rounded-full" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold flex items-center gap-2">
                                    <Star size={16} className="text-muted-foreground" /> Luz / Iluminação
                                </span>
                                <span className="text-sm font-bold text-blue-500">Nível 2 (Intermediário)</span>
                            </div>
                            <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[66%] rounded-full" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold flex items-center gap-2">
                                    <Trophy size={16} className="text-muted-foreground" /> Resolume
                                </span>
                                <span className="text-sm font-bold text-muted-foreground">Nível 1 (Básico)</span>
                            </div>
                            <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                                <div className="h-full bg-muted-foreground/50 w-[33%] rounded-full" />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Historico Recente */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Star className="text-yellow-500" /> Histórico Recente
                    </h2>
                    <div className="bg-card border border-border rounded-2xl p-0 overflow-hidden shadow-sm">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex justify-between items-center p-4 border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                                <div>
                                    <div className="font-bold">Culto da Família</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Operou Câmera 1 • Sem Faltas</div>
                                </div>
                                <div className="text-sm font-black text-green-500 bg-green-500/10 px-3 py-1 rounded-lg">
                                    +50 XP
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Zona de Perigo - Excluir Conta */}
            <div className="mt-12 pt-8 border-t border-red-500/20 flex flex-col items-center">
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Aviso: Ao deletar sua conta, seus registros, conquistas e horários serão perdidos permanentemente da igreja.
                </p>
                <button
                    onClick={handleDeleteAccount}
                    className="px-6 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all shadow-sm"
                >
                    Excluir Minha Conta (Irreversível)
                </button>
            </div>
        </div>
    );
}
