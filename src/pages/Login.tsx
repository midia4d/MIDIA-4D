import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, LogIn, Mail, Lock, AlertCircle, ArrowRight, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);

    // Campos Auth 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nome, setNome] = useState('');

    // Estados de UI
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    // Quando o componente montar, checar se ele já tem sessão e igreja
    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await rotearUsuarioLogado();
        }
    };

    // Função vital simplificada: Bypassa checagens de igreja e apenas empurra pra dentro
    const rotearUsuarioLogado = async () => {
        setLoading(true);
        try {
            navigate('/');
        } catch (err) {
            console.error("Erro catched ao rotear:", err);
            setErrorMsg("Falha ao entrar no aplicativo");
        } finally {
            setLoading(false);
        }
    };

    // FASE 1: Login / Registrar Usuário no Supabase Auth
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;

                // Logou, agora temos que checar se ele já tem Igreja vinculada no Profile
                if (data.user) {
                    await rotearUsuarioLogado();
                }
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: nome } // Salva o nome nos metadados pra Trigger puxar
                    }
                });
                if (error) throw error;

                if (data.user) {
                    setErrorMsg('Cadastro de usuário aprovado! Aguarde, direcionando...');
                    // O Cadastro faz o login automático na maioria das vezes
                    await rotearUsuarioLogado();
                }
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'Erro ao autenticar. Verifique seus dados.');
            setLoading(false);
        }
    };

    // Blocos Multi-Tenant RMOVIDOS A PEDIDO DO USUÁRIO. Fica apenas isLogin = true/false.


    return (
        <div className="min-h-screen bg-background border-border flex flex-col md:flex-row font-sans">
            {/* Lado da Imagem/Branding */}
            <div className="hidden md:flex flex-col w-1/2 p-12 bg-card relative overflow-hidden border-r border-border">
                {/* Decorative elements */}
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 font-bold text-3xl tracking-tighter flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Clapperboard size={20} />
                    </div>
                    <span className="text-foreground">MÍDIA 4D</span>
                </div>

                <div className="relative z-10 flex flex-col justify-center flex-1 space-y-6">
                    <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
                        Excelência <br />
                        <span className="text-blue-600">atrás das câmeras.</span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-md leading-relaxed font-medium">
                        Dedicação, Disciplina, Direção e Domínio. O seu passaporte para a plataforma definitiva de equipes de mídia.
                    </p>
                </div>
            </div>

            {/* Lado do Formulário */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background relative border-l border-slate-200">
                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 md:hidden" />

                {/* Mobile Header indicator */}
                <div className="mb-10 font-bold text-2xl tracking-tighter flex items-center gap-3 md:hidden">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Clapperboard size={16} />
                    </div>
                    <span className="text-foreground">MÍDIA 4D</span>
                </div>

                <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {errorMsg && (
                        <div className="bg-blue-100 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-start gap-3 text-sm font-bold shadow-sm">
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <p>{errorMsg}</p>
                        </div>
                    )}

                    <div className="space-y-2 text-center md:text-left">
                        <h2 className="text-3xl font-extrabold tracking-tight">
                            {isLogin ? 'Acesse sua conta' : 'Criar nova conta'}
                        </h2>
                        <p className="text-sm text-muted-foreground font-medium">
                            {isLogin ? 'Entre na sua conta para continuar.' : 'Junte-se ao time e inicie sua jornada.'}
                        </p>
                    </div>

                    <form className="space-y-4" onSubmit={handleAuth}>
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-sm font-bold ml-1 text-muted-foreground">Nome Completo</label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" required={!isLogin} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm font-medium" />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-bold ml-1 text-muted-foreground">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voluntario@email.com" required className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm font-medium" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-sm font-bold text-muted-foreground">Senha</label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm font-medium" />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-xl shadow-blue-600/20 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70">
                            {loading ? 'Verificando...' : (isLogin ? <><LogIn size={18} /> Entrar</> : <><ArrowRight size={18} /> Criar Conta</>)}
                        </button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground font-medium">
                        {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
                        <button onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }} className="font-bold text-blue-500 hover:text-blue-400 transition-colors">
                            {isLogin ? "Criar agora" : "Fazer Login"}
                        </button>
                    </p>

                </div>
            </div>
        </div>
    );
}
