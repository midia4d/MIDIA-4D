import { useEffect, useState } from 'react';
import { Trophy, Medal, Star, Flame, Target, Loader2, Video, CheckCircle2, Shield, HeartHandshake, Crown } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { getElo, ELOS_CONFIG } from '../lib/gamification';

export default function Ranking() {
    const { user } = useOutletContext<{ user: any }>();
    const [periodo, setPeriodo] = useState<'mensal' | 'geral'>('mensal');
    const [ranking, setRanking] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Conquistas reais do usuário logado
    const [userStats, setUserStats] = useState({ presencas: 0, faltas: 0, coberturas: 0 });

    useEffect(() => {
        const fetchRanking = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .order('xp', { ascending: false })
                .limit(periodo === 'geral' ? 100 : 15);

            if (data) setRanking(data);
            setLoading(false);
        };
        fetchRanking();
    }, [periodo]);

    useEffect(() => {
        if (!user) return;
        const fetchMyStats = async () => {
            const { data } = await supabase
                .from('escala_equipe')
                .select('status')
                .eq('membro_id', user.id);

            if (data) {
                const presencas = data.filter(h => h.status === 'confirmado').length;
                const faltas = data.filter(h => h.status === 'recusado').length;

                // Simulação temporária: ganha 1 cobertura a cada 5 cultos normais servidos
                const coberturas = Math.floor(presencas / 5);

                setUserStats({ presencas, faltas, coberturas });
            }
        };
        fetchMyStats();
    }, [user]);

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-yellow-500" size={32} /></div>;
    }

    // Calcula quais medalhas o usuário possui
    const hasPrimeiroPasso = userStats.presencas >= 1;
    const hasCirurgico = userStats.presencas >= 10;
    const hasNuncaFalhou = userStats.faltas === 0 && userStats.presencas >= 4; // Ao menos 1 mês servindo sem faltar
    const hasFielEscudeiro = userStats.coberturas >= 1; // Substituiu alguém de última hora
    const hasVeterano = userStats.presencas >= 50; // Marca 50 cultos
    const hasPilarDoReino = userStats.presencas >= 100; // Marca histórica 100 cultos

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-center md:text-left">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                        Hall of Fame
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">Os operadores mais dedicados e disciplinados do time.</p>
                </div>

                <div className="flex bg-card p-1 rounded-xl border border-border w-max shadow-sm mx-auto md:mx-0">
                    <button
                        onClick={() => setPeriodo('mensal')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                            periodo === 'mensal' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Neste Mês
                    </button>
                    <button
                        onClick={() => setPeriodo('geral')}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                            periodo === 'geral' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Geral
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Top 3 Cards (Podium) */}
                <div className="md:col-span-3 flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6 mt-8 mb-4">

                    {/* 2nd Place */}
                    {ranking[1] && (() => {
                        const elo1 = getElo(ranking[1].xp || 0);
                        return (
                            <div className="order-2 md:order-1 flex flex-col items-center w-full md:w-48 bg-card border border-border rounded-t-3xl rounded-b-xl p-6 shadow-sm relative pt-12 mt-8 md:mt-0">
                                <div className="absolute -top-8 w-16 h-16 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-white flex items-center justify-center font-black text-xl border-4 border-background shadow-lg">
                                    2
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-lg">{ranking[1].nome || 'Voluntário'}</div>
                                    <div className="text-sm font-bold text-slate-400 mt-1">{ranking[1].xp || 0} XP</div>
                                    <div className={`mt-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 ${elo1.color}`}>
                                        <elo1.icon size={12} /> {elo1.name}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 1st Place */}
                    {ranking[0] && (() => {
                        const elo0 = getElo(ranking[0].xp || 0);
                        return (
                            <div className="order-1 md:order-2 flex flex-col items-center w-full md:w-56 bg-gradient-to-b from-yellow-500/10 to-card border border-yellow-500/30 rounded-t-3xl rounded-b-xl p-6 shadow-lg shadow-yellow-500/5 relative pt-14 z-10">
                                <div className="absolute -top-6 text-yellow-500 drop-shadow-lg">
                                    <Trophy size={48} className="fill-current" />
                                </div>
                                <div className="absolute -top-10 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-black flex items-center justify-center font-black text-2xl border-4 border-background shadow-xl scale-110">
                                    1
                                </div>
                                <div className="text-center mt-4">
                                    <div className="font-black text-xl text-yellow-500">{ranking[0].nome || 'Voluntário'}</div>
                                    <div className="text-sm font-black text-foreground mt-1 bg-background px-3 py-1 rounded-full border border-border inline-block flex items-center gap-1">
                                        <Star size={12} className="text-yellow-500 fill-current" /> {ranking[0].xp || 0} XP
                                    </div>
                                    <div className={`mt-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 ${elo0.color}`}>
                                        <elo0.icon size={12} /> {elo0.name}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 3rd Place */}
                    {ranking[2] && (() => {
                        const elo2 = getElo(ranking[2].xp || 0);
                        return (
                            <div className="order-3 md:order-3 flex flex-col items-center w-full md:w-48 bg-card border border-border rounded-t-3xl rounded-b-xl p-6 shadow-sm relative pt-12 mt-12 md:mt-0">
                                <div className="absolute -top-8 w-16 h-16 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 text-white flex items-center justify-center font-black text-xl border-4 border-background shadow-lg">
                                    3
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-lg">{ranking[2].nome || 'Voluntário'}</div>
                                    <div className="text-sm font-bold text-amber-600 mt-1">{ranking[2].xp || 0} XP</div>
                                    <div className={`mt-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 ${elo2.color}`}>
                                        <elo2.icon size={12} /> {elo2.name}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                </div>

            </div>

            {/* Gamification Info Section or Complete Leaderboard */}
            {periodo === 'geral' ? (
                <div className="md:col-span-3 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-2xl font-black mb-6 flex items-center justify-center md:justify-start gap-2 text-foreground">
                        <Trophy className="text-yellow-500" /> Classificação Global
                    </h3>
                    <div className="bg-card border border-border rounded-3xl p-2 md:p-4 shadow-sm flex flex-col gap-2">
                        {ranking.map((membro, index) => {
                            const elo = getElo(membro.xp || 0);
                            return (
                                <div key={membro.id} className={cn(
                                    "flex items-center justify-between p-4 rounded-2xl transition-all border",
                                    membro.id === user?.id
                                        ? "bg-yellow-500/5 border-yellow-500/30"
                                        : "bg-transparent border-transparent hover:bg-accent/50 hover:border-border"
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm",
                                            index === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black shadow-lg shadow-yellow-500/20 border-2 border-yellow-300" :
                                                index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black shadow-lg shadow-slate-500/20 border-2 border-slate-300" :
                                                    index === 2 ? "bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-lg shadow-amber-900/20 border-2 border-amber-700" :
                                                        "bg-accent text-muted-foreground border-2 border-border"
                                        )}>
                                            {index + 1}º
                                        </div>
                                        <div>
                                            <div className="font-bold text-base text-foreground flex items-center gap-2">
                                                {membro.nome || 'Voluntário'}
                                                {membro.id === user?.id && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full uppercase tracking-wider border border-yellow-500/20">Você</span>}
                                            </div>
                                            <div className={`mt-0.5 text-xs font-bold uppercase tracking-widest flex items-center gap-1 ${elo.color}`}>
                                                <elo.icon size={12} /> {elo.name}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-lg text-foreground flex items-center gap-1 justify-end">
                                            <Star size={14} className="text-yellow-500 fill-current" />
                                            {membro.xp || 0}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {ranking.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground font-medium">
                                Nenhuma pontuação registrada ainda.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">

                    {/* Trilha de Patentes (Elos) */}
                    <div>
                        <h3 className="text-xl font-bold mb-4 ml-1 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Crown className="text-yellow-500" /> Trilha de Patentes</span>
                            <span className="text-sm font-black bg-gradient-to-r from-yellow-500 to-amber-600 text-transparent bg-clip-text px-3 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20 shadow-sm flex items-center gap-1">Você tem: {user?.xp || 0} XP</span>
                        </h3>

                        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
                            {/* O array original começa do Maior (Diamante) pro Menor (Ferro).
                                Vamos inverter para exibir do Ferro (Base) ao Diamante (Topo).
                                Mas a UI de "trilha" geralmente mostra o topo em cima, então
                                o ELOS_CONFIG original já está perfeito (Diamante no topo). */}
                            {ELOS_CONFIG.map((elo, index) => {
                                const hasUnlocked = (user?.xp || 0) >= elo.minXp;
                                const isNext = !hasUnlocked && (index === ELOS_CONFIG.length - 1 || (user?.xp || 0) >= ELOS_CONFIG[index + 1].minXp);

                                return (
                                    <div key={elo.name} className="relative">
                                        {/* Linha conectora (exceto no último item) */}
                                        {index < ELOS_CONFIG.length - 1 && (
                                            <div className="absolute left-6 top-10 bottom-[-16px] w-0.5 bg-border z-0" />
                                        )}

                                        <div className={cn(
                                            "flex items-center gap-4 transition-all relative z-10",
                                            !hasUnlocked && "opacity-50 grayscale"
                                        )}>
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2",
                                                hasUnlocked ? cn(elo.bg, elo.border, elo.color) : "bg-accent/50 border-border text-muted-foreground"
                                            )}>
                                                <elo.icon size={24} className={hasUnlocked ? "drop-shadow-sm" : ""} />
                                            </div>
                                            <div className="flex-1">
                                                <div className={cn(
                                                    "font-black text-sm flex items-center gap-2",
                                                    hasUnlocked ? elo.color : "text-muted-foreground"
                                                )}>
                                                    {elo.name}
                                                    {hasUnlocked && <CheckCircle2 size={14} className={elo.color} />}
                                                    {isNext && <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Próximo</span>}
                                                </div>
                                                <div className="text-xs font-bold text-muted-foreground mt-0.5 flex items-center gap-1">
                                                    <Star size={10} className={hasUnlocked ? "text-yellow-500 fill-current" : ""} />
                                                    {elo.minXp} XP
                                                    {isNext && <span className="text-blue-500 ml-1">({elo.minXp - (user?.xp || 0)} p/ faltam)</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Minhas Medalhas Módulo */}
                    <div>
                        <h3 className="text-xl font-bold mb-4 ml-1 flex items-center gap-2">
                            <Medal className="text-yellow-500" /> Suas Conquistas
                        </h3>

                        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">

                            {/* Card Dinâmico: Primeiro Passo */}
                            <div className={cn("flex items-center gap-4 transition-opacity", !hasPrimeiroPasso && "opacity-40 grayscale")}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-green-500/20 shrink-0">
                                    <Target size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-sm text-foreground flex items-center gap-2">
                                        Primeiro Passo {hasPrimeiroPasso && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">Venceu a inércia e serviu no seu primeiro culto na Mídia 4D.</div>
                                </div>
                            </div>

                            {/* Card Dinâmico: Nunca Falhou */}
                            <div className={cn("flex items-center gap-4 transition-opacity", !hasNuncaFalhou && "opacity-40 grayscale")}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                                    <Flame size={24} className="fill-current" />
                                </div>
                                <div>
                                    <div className="font-black text-sm text-foreground flex items-center gap-2">
                                        Nunca Falhou {hasNuncaFalhou && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">O "Crente Fiel". Ao menos 1 Mês consecutivo sem faltar em nenhuma escala em que foi chamado.</div>
                                </div>
                            </div>

                            {/* Card Dinâmico: Fiel Escudeiro */}
                            <div className={cn("flex items-center gap-4 transition-opacity", !hasFielEscudeiro && "opacity-40 grayscale")}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
                                    <HeartHandshake size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-sm text-foreground flex items-center gap-2">
                                        Fiel Escudeiro {hasFielEscudeiro && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">"Conta comigo". Entrou de última hora para cobrir a escala de alguém que faltou.</div>
                                </div>
                            </div>

                            {/* Card Dinâmico: Operador Cirúrgico */}
                            <div className={cn("flex items-center gap-4 transition-opacity", !hasCirurgico && "opacity-40 grayscale")}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                                    <Video size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-sm text-foreground flex items-center gap-2">
                                        Operador Cirúrgico {hasCirurgico && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">Acumulou a marca de 10 escalas oficiais servidas na Mídia 4D com excelência.</div>
                                </div>
                            </div>

                            {/* Card Dinâmico: Veterano (50 Cultos) */}
                            <div className={cn("flex items-center gap-4 transition-opacity", !hasVeterano && "opacity-40 grayscale")}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-sm text-foreground flex items-center gap-2">
                                        Veterano Honorário {hasVeterano && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">Ultrapassou a marca servindo em mais de 50 cultos para a igreja. Uma verdadeira rocha!</div>
                                </div>
                            </div>

                            {/* Card Dinâmico: Pilar do Reino (100 Cultos) */}
                            <div className={cn("flex items-center gap-4 transition-opacity", !hasPilarDoReino && "opacity-40 grayscale")}>
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-600 text-white flex items-center justify-center shadow-lg shadow-yellow-500/30 border border-yellow-300 shrink-0">
                                    <Crown size={24} className="fill-current" />
                                </div>
                                <div>
                                    <div className="font-black text-sm text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-600 flex items-center gap-2">
                                        Pilar do Reino {hasPilarDoReino && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-snug">Medalha Suprema: Atingiu as místicas 100 escalas servidas. Você é a coluna desta equipe!</div>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
