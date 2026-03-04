import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, Clapperboard, GraduationCap, Trophy, BarChart, LogOut, CalendarDays, User, Loader2, ShieldAlert, Menu, X, Bell, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const sidebarLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CalendarDays, label: 'Minha Disponibilidade', path: '/disponibilidade' },
    { icon: Users, label: 'Gerir Escalas', path: '/escalas' },
    { icon: CheckSquare, label: 'Checklists (Disciplina)', path: '/checklists' },
    { icon: Clapperboard, label: 'Roteiro (Direção)', path: '/roteiro' },
    { icon: GraduationCap, label: 'Academia (Domínio)', path: '/academia' },
    { icon: Trophy, label: 'Ranking', path: '/ranking' },
    { icon: BarChart, label: 'Impacto', path: '/impacto' },
];

export default function AppLayout() {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Notifications State
    const [notifications, setNotifications] = useState<any[]>([]);
    const [toastNotifs, setToastNotifs] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    // Audio Player Reference
    const playNotificationSound = () => {
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Áudio bloqueado pelo navegador", e));
    };

    useEffect(() => {
        let mounted = true;

        const checkUser = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                navigate('/login');
                return;
            }

            if (mounted) {
                setUser(data.session.user);
                setLoading(false);
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.session.user.id)
                .single();

            if (profile && mounted) {
                setUser(profile);
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                navigate('/login');
            } else if (mounted && !user) {
                checkUser();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Fetch and Subscribe to Notifications
    useEffect(() => {
        if (!user?.id) return;

        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notificacoes')
                .select('*')
                .eq('membro_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.lida).length);
            }
        };

        fetchNotifications();

        // O 'isMounted' reference para não dar memory leak
        const channel = supabase.channel(`notificacoes_${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notificacoes',
                filter: `membro_id=eq.${user.id}`
            }, (payload) => {
                // Toca Som de Notificação
                playNotificationSound();

                // Adiciona a nova na lista e aumenta o contador (sem precisar de F5)
                setNotifications(prev => [payload.new, ...prev].slice(0, 20));
                setUnreadCount(prev => prev + 1);

                // Exibe o Toast animado
                setToastNotifs(prev => [...prev, payload.new]);
                setTimeout(() => {
                    setToastNotifs(t => t.filter(n => n.id !== payload.new.id));
                }, 5000);
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notificacoes',
                filter: `membro_id=eq.${user.id}`
            }, () => {
                // Se o usuário ler em outra aba, apenas ressincroniza
                fetchNotifications();
            })
            .subscribe();

        // Inscreve também nas mudanças do PERFIL (XP)
        const profileChannel = supabase.channel(`perfil_xp_${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                // Atualiza o contexto de usuário global se o XP mudar
                setUser((prev: any) => {
                    if (!prev) return prev;
                    return { ...prev, xp: payload.new.xp };
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(profileChannel);
        };
    }, [user?.id]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const markAsRead = async (notificacaoId: string) => {
        await supabase.from('notificacoes').update({ lida: true }).eq('id', notificacaoId);
        setNotifications(prev => prev.map(n => n.id === notificacaoId ? { ...n, lida: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) return;
        await supabase.from('notificacoes').update({ lida: true }).eq('membro_id', user.id).eq('lida', false);
        setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
        setUnreadCount(0);
    };

    const handleNotificationClick = (notificacao: any) => {
        if (!notificacao.lida) {
            markAsRead(notificacao.id);
        }
        if (notificacao.link) {
            setIsNotificationsOpen(false);
            navigate(notificacao.link);
        }
    };

    // Função auxiliar para renderizar a estrutura interna do Menu de navegação (útil para Desktop e Mobile não repetir código)
    const renderNavContent = () => (
        <>
            <div className="p-6 font-bold text-2xl tracking-tighter flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Clapperboard size={18} />
                </div>
                <span className="text-foreground">MÍDIA 4D</span>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto w-full">
                {sidebarLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            onClick={() => setIsMobileMenuOpen(false)} // Fecha menu nativamente ao clicar
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium w-full",
                                    isActive
                                        ? "bg-blue-600/10 text-blue-500 shadow-sm border border-blue-500/20"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )
                            }
                        >
                            <Icon size={18} />
                            {link.label}
                        </NavLink>
                    );
                })}

                {user?.role === 'admin' && (
                    <div className="pt-4 mt-4 border-t border-border">
                        <div className="text-[10px] uppercase font-black text-muted-foreground tracking-widest px-3 mb-2">Administração</div>
                        <NavLink
                            to="/admin"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold w-full",
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                        : "text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <ShieldAlert size={18} className={isActive ? "text-indigo-200" : ""} />
                                    Painel Admin
                                </>
                            )}
                        </NavLink>
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-border bg-card">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors justify-start"
                >
                    <LogOut size={18} />
                    Sair da Conta
                </button>
            </div>

            <div className="p-4 border-t border-border space-y-2 w-full mt-auto bg-card">
                <button
                    onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsNotificationsOpen(true);
                    }}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors justify-between md:hidden"
                >
                    <div className="flex items-center gap-3">
                        <Bell size={18} />
                        Notificações
                    </div>
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                </button>
                <div className="px-3 py-2 mb-2 text-sm w-full overflow-hidden border-t border-border/50 md:border-t-0 pt-2 md:pt-0">
                    <div className="font-bold truncate">{user?.nome || user?.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{user?.funcao_principal || 'Voluntário'}</div>
                </div>
                <Link to="/perfil" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <User size={18} />
                    Meu Perfil
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <LogOut size={18} />
                    Sair
                </button>
            </div>
        </>
    );

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground space-y-4">
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <div className="text-muted-foreground font-bold tracking-widest text-sm animate-pulse">Sincronizando...</div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden font-sans relative">

            {/* Overlays */}
            {(isMobileMenuOpen || isNotificationsOpen) && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm animate-in fade-in"
                    onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsNotificationsOpen(false);
                    }}
                />
            )}

            {/* Toasts Flutuantes */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none w-11/12 sm:w-80">
                {toastNotifs.map(toast => (
                    <div key={toast.id} className="bg-card border border-border shadow-2xl rounded-2xl p-4 flex gap-4 items-start animate-in slide-in-from-top-5 fade-in pointer-events-auto">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                            <Bell size={18} />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                            <h4 className="font-bold text-sm text-foreground">{toast.titulo}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{toast.mensagem}</p>
                        </div>
                        <button onClick={() => setToastNotifs(t => t.filter(n => n.id !== toast.id))} className="text-muted-foreground hover:bg-accent rounded-lg p-1 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Sidebar Mobile (Deslizante da Esquerda) */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute top-5 right-4 p-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                >
                    <X size={20} />
                </button>
                {renderNavContent()}
            </aside>

            {/* Navbar de Notificações (Deslizante da Direita) */}
            <aside
                className={cn(
                    "fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-card border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out",
                    isNotificationsOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                <div className="p-4 border-b border-border flex items-center justify-between bg-card shrink-0">
                    <div className="flex items-center gap-2">
                        <Bell className="text-foreground" size={20} />
                        <h2 className="font-bold text-lg">Notificações</h2>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors mr-2"
                            >
                                Marcar todas lidas
                            </button>
                        )}
                        <button
                            onClick={() => setIsNotificationsOpen(false)}
                            className="p-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <Bell size={32} className="mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma notificação</p>
                        </div>
                    ) : (
                        notifications.map((notificacao) => {
                            let NotifIcon = Info;
                            let iconColor = "text-blue-500";
                            let iconBg = "bg-blue-500/10";

                            if (notificacao.tipo === 'warning') {
                                NotifIcon = AlertTriangle;
                                iconColor = "text-yellow-500";
                                iconBg = "bg-yellow-500/10";
                            } else if (notificacao.tipo === 'success') {
                                NotifIcon = CheckCircle;
                                iconColor = "text-green-500";
                                iconBg = "bg-green-500/10";
                            } else if (notificacao.tipo === 'escala') {
                                NotifIcon = CalendarDays;
                                iconColor = "text-indigo-500";
                                iconBg = "bg-indigo-500/10";
                            }

                            return (
                                <div
                                    key={notificacao.id}
                                    onClick={() => handleNotificationClick(notificacao)}
                                    className={cn(
                                        "p-3 rounded-xl border flex gap-3 cursor-pointer transition-colors relative overflow-hidden",
                                        notificacao.lida ? "bg-background border-border" : "bg-card border-blue-500/30 shadow-sm"
                                    )}
                                >
                                    {!notificacao.lida && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                    )}
                                    <div className={cn("w-10 h-10 rounded-full flex shrink-0 items-center justify-center", iconBg, iconColor)}>
                                        <NotifIcon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={cn("text-sm truncate", notificacao.lida ? "font-medium text-foreground" : "font-bold text-foreground")}>
                                            {notificacao.titulo}
                                        </h4>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                            {notificacao.mensagem}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground/60 mt-2 block">
                                            {new Date(notificacao.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </aside>

            {/* Sidebar Desktop (Fixa) */}
            <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col flex-shrink-0">
                {renderNavContent()}
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">

                {/* Header Superior - Mobile e Desktop para abrigar avisos globais e o Sino no Desktop */}
                <header className="h-16 flex-shrink-0 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 shadow-sm z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent text-foreground hover:bg-accent/80 transition-colors md:hidden"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="font-bold text-xl flex items-center gap-2 md:hidden">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <Clapperboard size={14} />
                            </div>
                            MÍDIA 4D
                        </div>
                        {/* Em desktop, podemos mostrar a rota atual ou saudação */}
                        <div className="hidden md:block font-medium text-muted-foreground">
                            Olá, <span className="text-foreground">{user?.nome?.split(' ')[0] || 'Voluntário'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsNotificationsOpen(true)}
                            className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-card animate-pulse"></span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Dynamic Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-24 md:pb-8">
                    <Outlet context={{ user }} />
                </main>
            </div>
        </div>
    );
}
