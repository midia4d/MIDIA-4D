import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import type { EloConfig } from '../lib/gamification';
import { cn } from '../lib/utils';
import { Sparkles, Trophy, X } from 'lucide-react';

interface LevelUpModalProps {
    oldElo?: EloConfig | null;
    newElo: EloConfig;
    isOpen: boolean;
    onClose: () => void;
}

export function LevelUpModal({ oldElo, newElo, isOpen, onClose }: LevelUpModalProps) {
    const { width, height } = useWindowSize();
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 8000); // 8 segundos de chuva de papel
            return () => clearTimeout(timer);
        } else {
            setShowConfetti(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const Icon = newElo.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop Blur */}
            <div className="absolute inset-0 bg-background/90 backdrop-blur-md animate-in fade-in duration-500" />

            {/* Confetti full screen overlay */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-[110]">
                    <Confetti
                        width={width}
                        height={height}
                        recycle={false}
                        numberOfPieces={500}
                        gravity={0.15}
                        colors={['#eab308', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f97316']}
                    />
                </div>
            )}

            {/* Modal Content */}
            <div className="relative z-[120] bg-card w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-border/50 animate-in zoom-in-50 slide-in-from-bottom-8 duration-700 ease-out flex flex-col items-center text-center overflow-hidden">

                {/* Glow Background radial effect */}
                <div className={cn("absolute inset-0 opacity-20 bg-gradient-to-br", newElo.bg)} />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent text-muted-foreground transition-colors z-10"
                >
                    <X size={20} />
                </button>

                <div className="relative mb-6">
                    {/* Pulsing ring */}
                    <div className={cn("absolute -inset-4 rounded-full opacity-50 blur-xl animate-pulse", newElo.bg)} />

                    {/* Core Medal */}
                    <div className={cn(
                        "w-32 h-32 rounded-3xl rotate-12 flex items-center justify-center shadow-2xl border-4 transform transition-transform hover:scale-110",
                        newElo.bg,
                        newElo.border,
                        newElo.color
                    )}>
                        <Icon size={64} className="drop-shadow-lg -rotate-12" />
                        <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-pulse" />
                        <Sparkles className="absolute -bottom-1 -left-1 w-6 h-6 text-white/50 animate-bounce" />
                    </div>
                </div>

                <div className="space-y-2 relative z-10">
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground flex items-center justify-center gap-2">
                        <Trophy size={12} className="text-yellow-500" />
                        PROMOÇÃO DE PATENTE
                    </span>
                    <h2 className="text-4xl font-black text-foreground drop-shadow-sm">
                        Subiu de Nível!
                    </h2>

                    <p className="text-muted-foreground mt-4 text-sm leading-relaxed max-w-[250px] mx-auto">
                        {oldElo ? (
                            <>
                                O seu esforço foi recompensado. Você saiu da patente <strong className={cn("font-black", oldElo.color)}>{oldElo.name}</strong> para se tornar <strong className={cn("font-black text-lg", newElo.color)}>{newElo.name}</strong>!
                            </>
                        ) : (
                            <>
                                Parabéns! Você agora é um <strong className={cn("font-black text-lg", newElo.color)}>{newElo.name}</strong> oficial do Mídia 4D!
                            </>
                        )}
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className={cn(
                        "mt-10 px-8 py-4 w-full rounded-2xl font-black text-white shadow-xl transition-all hover:scale-105 active:scale-95",
                        "bg-gradient-to-r", newElo.bg, newElo.border
                    )}
                    style={{ backgroundImage: 'none' }} // Tailwind gradient overrides in some cases, so we rely on bg classes
                >
                    <span className={cn("drop-shadow-md", newElo.color)}>Continuar Servindo</span>
                </button>
            </div>
        </div>
    );
}
