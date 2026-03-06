import { CalendarCheck, Flame, Star, Video, Loader2, Sparkles, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { supabase } from "../lib/supabase";
import { getElo } from "../lib/gamification";
import { cn } from "../lib/utils";

export default function Dashboard() {
    const { user } = useOutletContext<{ user: any }>();
    const [minhasEscalas, setMinhasEscalas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Boas-Vindas state
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (!user) return;
        let isMounted = true;

        // Dispara Modal de Boas-Vindas se tiver 50 XP e for a primeira vez
        const welcomeKey = `welcome_${user.id}`;
        const hasSeenWelcome = localStorage.getItem(welcomeKey);

        if (!hasSeenWelcome && user.xp === 50) {
            setShowWelcomeModal(true);
            setShowConfetti(true);
            setTimeout(() => {
                if (isMounted) setShowConfetti(false);
            }, 8000);
            localStorage.setItem(welcomeKey, 'true');
        }

        const fetchMinhasEscalas = async () => {
            setIsLoading(true);

            // Buscar escalas futuras em que o usuário está alocado (pendente ou confirmado)
            const hoje = new Date().toISOString();

            const { data } = await supabase
                .from('escala_equipe')
                .select(`
                    id, funcao, status,
                    escalas ( id, titulo, data_horario )
                `)
                .eq('membro_id', user.id)
                .neq('status', 'recusado')
                .gte('escalas.data_horario', hoje)
                .order('id', { ascending: false })
                .limit(3);

            if (data && isMounted) {
                // Formatar dados e limpar escalas nulas
                const validEscalas = data.filter(e => e.escalas !== null).map((e: any) => {
                    const dateObj = new Date(e.escalas.data_horario);
                    return {
                        id: e.escalas.id,
                        equipeId: e.id,
                        title: e.escalas.titulo,
                        date: dateObj.toLocaleDateString('pt-BR', { day: '2-digit' }),
                        day: dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }),
                        time: dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        role: e.funcao,
                        status: e.status
                    };
                }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                setMinhasEscalas(validEscalas);
            }
            if (isMounted) setIsLoading(false);
        };

        fetchMinhasEscalas();
        return () => { isMounted = false; };
    }, [user?.id]); // Watch ONLY for ID changes to prevent infinite triggering loops from whole object

    if (!user) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center space-y-4 pt-20">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <span className="text-muted-foreground font-medium animate-pulse">Carregando perfil...</span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header Profile Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Bem-vindo, {user.nome?.split(' ')[0] || 'Operador'}!</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Pronto para transformar a atmosfera do próximo culto?</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
                    {(() => {
                        const elo = getElo(user?.xp || 0);
                        return (
                            <>
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border", elo.bg, elo.color, elo.border)}>
                                    <elo.icon size={20} className="fill-current" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Nível de Confiabilidade</div>
                                    <div className={cn("font-extrabold", elo.color)}>{elo.name}</div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Star className="text-blue-500 fill-blue-500/20" />} title="XP Total" value={user.xp?.toString() || "0"} />
                <StatCard icon={<CalendarCheck className="text-green-500" />} title="Frequência" value="95%" />
                <StatCard icon={<Flame className="text-orange-500 fill-orange-500/20" />} title="Ofensiva" value="4 Semanas" />
                <StatCard icon={<Video className="text-purple-500" />} title="Pessoas Alcançadas" value="1.2k" subtitle="Nos seus cultos" />
            </div>

            {/* Main Grid: Escalas & Conquistas */}
            <div className="grid grid-cols-1 gap-6">

                {/* Proximas Escalas (Dedicação) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CalendarCheck className="text-blue-500" /> Próximas Escalas
                        </h2>
                        <button className="text-sm text-blue-500 font-medium hover:underline">Ver todas</button>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-0 overflow-hidden shadow-md">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="animate-spin text-blue-500" size={32} />
                            </div>
                        ) : minhasEscalas.length === 0 ? (
                            <div className="p-8 text-center bg-accent/20">
                                <p className="text-muted-foreground font-bold">Nenhuma escala nas próximas semanas.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Quando você for escalado, a data aparecerá aqui.</p>
                            </div>
                        ) : (
                            minhasEscalas.map((escala, i) => (
                                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-border last:border-0 hover:bg-accent/30 transition-colors gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex flex-col items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{escala.day}</span>
                                            <span className="font-black text-xl leading-none">{escala.date}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{escala.title}</h3>
                                            <p className="text-sm text-muted-foreground font-medium">
                                                Função: <span className="text-foreground">{escala.role}</span> • {escala.time}
                                            </p>
                                        </div>
                                    </div>
                                    {escala.status === 'confirmado' ? (
                                        <span className="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 text-sm font-bold rounded-lg text-center flex items-center justify-center gap-2">
                                            <CalendarCheck size={16} /> Confirmado
                                        </span>
                                    ) : (
                                        <span className="px-4 py-2 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-sm font-bold rounded-lg text-center flex items-center justify-center gap-2 animate-pulse">
                                            <CalendarCheck size={16} /> Pendente na Aba Escalas
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Magnífico de Boas Vindas */}
            {showWelcomeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-500">
                    {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={600} gravity={0.15} />}

                    <div className="bg-card w-full max-w-sm border border-border rounded-3xl p-8 shadow-2xl relative text-center flex flex-col items-center animate-in zoom-in-95 duration-700">
                        <button onClick={() => setShowWelcomeModal(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
                            <X size={24} />
                        </button>

                        <div className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex items-center justify-center text-5xl shadow-xl shadow-yellow-500/30 mb-6 relative ring-4 ring-yellow-400/20">
                            🎁
                        </div>

                        <h2 className="text-2xl font-black mb-2 flex items-center gap-2 justify-center text-foreground">
                            <Sparkles className="text-yellow-500" /> Bônus Surpresa!
                        </h2>

                        <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
                            Apenas por aceitar esse chamado e fazer parte da <span className="text-foreground font-bold">Mídia 4D</span>, você acaba de ganhar <span className="text-yellow-500 font-black text-lg bg-yellow-500/10 px-2 rounded-md">50 XP</span> iniciais para largar na frente no Ranking de Engajamento!
                        </p>

                        <button onClick={() => setShowWelcomeModal(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 text-lg">
                            Bora Servir! 🚀
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, title, value, subtitle }: { icon: React.ReactNode, title: string, value: string, subtitle?: string }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-1.5 shadow-md relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity scale-150">
                {icon}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs uppercase tracking-wider relative z-10">
                {icon}
                {title}
            </div>
            <div className="text-3xl font-black mt-1 relative z-10">{value}</div>
            {subtitle && <div className="text-xs text-muted-foreground font-medium relative z-10">{subtitle}</div>}
        </div>
    );
}
