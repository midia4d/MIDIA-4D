import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Activity, Users, Church, AlertOctagon, TrendingUp, Loader2, Database, PowerOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SuperAdmin() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [igrejas, setIgrejas] = useState<any[]>([]);
    const [perfisGlobais, setPerfisGlobais] = useState<any[]>([]);

    // Auth Check
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const verifyMasterAccess = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { navigate('/'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('id', session.user.id)
                .single();

            if (!profile?.is_super_admin) {
                navigate('/');
                return;
            }

            setIsSuperAdmin(true);

            // Se for Master, RLS deixa ele dar fetch em TODOS os dados mundiais sem o filtro de igreja_id!
            const [respIgrejas, respPerfis] = await Promise.all([
                supabase.from('igrejas').select('*', { count: 'exact' }),
                supabase.from('profiles').select('id, igreja_id, nome, role', { count: 'exact' })
            ]);

            setIgrejas(respIgrejas.data || []);
            setPerfisGlobais(respPerfis.data || []);
            setLoading(false);
        };

        verifyMasterAccess();
    }, [navigate]);

    const toggleStatusSuspense = async (igrejaId: string, atualStatus: string) => {
        const novoStatus = atualStatus === 'ativa' ? 'suspensa' : 'ativa';
        const msg = novoStatus === 'suspensa' ? "Tem certeza que deseja SUSPENDER o acesso dessa Igreja ao sistema Mídia 4D?" : "Deseja REATIVAR o acesso dessa Igreja?";
        if (!window.confirm(msg)) return;

        setLoading(true);
        const { error } = await supabase
            .from('igrejas')
            .update({ status_assinatura: novoStatus })
            .eq('id', igrejaId);

        if (error) {
            alert("Erro de bloqueio no Banco de Dados: " + error.message);
        } else {
            setIgrejas(prev => prev.map(ig => ig.id === igrejaId ? { ...ig, status_assinatura: novoStatus } : ig));
        }
        setLoading(false);
    };

    if (!isSuperAdmin) return null; // Prevenção de flash de conteúdo pro hacker

    if (loading) {
        return <div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto text-yellow-500 mb-4" size={40} /> Carregando Painel Core...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Cabecalho Perigoso */}
            <div className="bg-gradient-to-r from-red-600/20 to-orange-500/20 border border-red-500/50 rounded-2xl p-6 shadow-xl shadow-red-500/5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-500 p-3 rounded-xl text-white shadow-lg">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-red-500 tracking-tight">Master Control <span className="text-muted-foreground font-medium text-lg ml-2">SaaS Dashboard</span></h1>
                            <p className="text-red-400/80 font-bold uppercase tracking-wider text-xs flex items-center gap-1 mt-1">
                                <AlertOctagon size={12} /> Área de Risco: Alterações aqui afetam todas as instâncias do sistema global.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs Globais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-center">
                    <div className="flex items-center gap-3 text-muted-foreground font-bold uppercase text-xs tracking-wider mb-2">
                        <Church size={16} /> Total de Igrejas (Workspaces)
                    </div>
                    <div className="text-4xl font-black">{igrejas.length}</div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-center">
                    <div className="flex items-center gap-3 text-muted-foreground font-bold uppercase text-xs tracking-wider mb-2">
                        <Users size={16} /> Usuários Ativos
                    </div>
                    <div className="text-4xl font-black text-blue-500">{perfisGlobais.length}</div>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-5 text-green-500">
                        <Activity size={100} />
                    </div>
                    <div className="flex items-center gap-3 text-green-500 font-bold uppercase text-xs tracking-wider mb-2">
                        <TrendingUp size={16} /> Saúde do SaaS
                    </div>
                    <div className="text-4xl font-black text-green-500">100%</div>
                    <span className="text-xs text-muted-foreground mt-1">Todos os sistemas operantes</span>
                </div>
            </div>

            {/* Lista de Igrejas (Clientes) */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border flex justify-between items-center bg-accent/20">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Database className="text-blue-500" size={20} /> Clientes e Assinaturas
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-accent/40 text-muted-foreground font-bold uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Nome da Igreja / Organização</th>
                                <th className="px-6 py-4 text-center">Código Convite</th>
                                <th className="px-6 py-4 text-center">Voluntários</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Ação Super Admin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {igrejas.map((ig) => {
                                const qtdUsuarios = perfisGlobais.filter(p => p.igreja_id === ig.id).length;
                                const isAtiva = ig.status_assinatura === 'ativa' || !ig.status_assinatura; // Fallback pra igrejas velhas

                                return (
                                    <tr key={ig.id} className="hover:bg-accent/20 transition-colors">
                                        <td className="px-6 py-4 font-bold text-base flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Church size={16} />
                                            </div>
                                            {ig.nome}
                                            <span className="text-xs font-normal text-muted-foreground block">{ig.id}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-background border border-border px-3 py-1 rounded-md font-mono font-bold tracking-widest text-muted-foreground">
                                                {ig.codigo_convite}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-center justify-center bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full font-bold">
                                                <Users size={14} className="mr-1.5" /> {qtdUsuarios}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isAtiva ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Ativa
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                                    Suspensa
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toggleStatusSuspense(ig.id, isAtiva ? 'ativa' : 'suspensa')}
                                                className={`p-2 rounded-xl transition-all shadow-sm ${isAtiva ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/20'}`}
                                                title={isAtiva ? "Suspender Igreja" : "Reativar Igreja"}
                                            >
                                                <PowerOff size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {igrejas.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        Nenhuma Igreja cadastrada na plataforma ainda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
