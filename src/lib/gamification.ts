import { Shield, ShieldAlert, ShieldCheck, Crown, Gem } from 'lucide-react';

export type Elo = 'Ferro' | 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';

export interface EloConfig {
    name: Elo;
    minXp: number;
    color: string;
    bg: string;
    border: string;
    icon: any; // typeof LucideIcon
}

export const ELOS_CONFIG: EloConfig[] = [
    {
        name: 'Diamante',
        minXp: 3000,
        color: 'text-cyan-400',
        bg: 'from-cyan-500/20 to-blue-600/20',
        border: 'border-cyan-500/40',
        icon: Gem
    },
    {
        name: 'Ouro',
        minXp: 1500,
        color: 'text-yellow-400',
        bg: 'from-yellow-500/20 to-amber-600/20',
        border: 'border-yellow-500/40',
        icon: Crown
    },
    {
        name: 'Prata',
        minXp: 500,
        color: 'text-slate-300',
        bg: 'from-slate-400/20 to-slate-600/20',
        border: 'border-slate-400/40',
        icon: ShieldCheck
    },
    {
        name: 'Bronze',
        minXp: 150,
        color: 'text-orange-400',
        bg: 'from-orange-500/20 to-amber-700/20',
        border: 'border-orange-500/40',
        icon: ShieldAlert
    },
    {
        name: 'Ferro',
        minXp: 0,
        color: 'text-zinc-500',
        bg: 'from-zinc-500/10 to-stone-700/10',
        border: 'border-zinc-500/30',
        icon: Shield
    }
];

export function getElo(xp: number): EloConfig {
    // Array comes ordered from highest to lowest in ELOS_CONFIG to make `find` easy
    const userXp = xp || 0;
    const elo = ELOS_CONFIG.find(e => userXp >= e.minXp);
    return elo || ELOS_CONFIG[ELOS_CONFIG.length - 1]; // Default to lowest if something goes wrong
}

export function getNextElo(xp: number): EloConfig | null {
    const userXp = xp || 0;
    // Array invertido (menor para maior) para achar o próximo
    const elosReversed = [...ELOS_CONFIG].reverse();
    const next = elosReversed.find(e => e.minXp > userXp);
    return next || null; // Null se já for Diamante
}
