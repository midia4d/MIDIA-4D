import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, LogIn, Mail, Lock, AlertCircle, ArrowRight, UserPlus, Building2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
    // Fases: 'auth' (Login/Registro base) -> 'check_igreja' (procurar vinculo) -> 'codigo' (digitar invite) -> 'nova_igreja' (cadastrar church)
    const [fase, setFase] = useState<'auth' | 'codigo' | 'nova_igreja'>('auth');
    const [isLogin, setIsLogin] = useState(true);

    // Campos Auth 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nome, setNome] = useState('');

    // Campos Tenant (Igreja)
    const [codigoConvite, setCodigoConvite] = useState('');
    const [nomeIgreja, setNomeIgreja] = useState('');

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
            await rotearUsuarioLogado(session.user.id);
        }
    };

    // Função vital para saber se ele pula o Onboarding ou não
    const rotearUsuarioLogado = async (userId: string) => {
        setLoading(true);
        try {
            // Verifica se o usuário já tem uma igreja vinculada no Profile
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('igreja_id, id')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                // Erro de conexão ou RLS extremo
                console.error("Erro no rotearUsuarioLogado:", error);
                setFase('codigo');
                return;
            }

            // SE O PERFIL NÃO EXISTE DE JEITO NENHUM NO BANCO REAL (Conta Zumbi cacheada no navegador)
            if (!profile) {
                console.warn("Conta Zumbi deletada do backend. Forçando Limpeza Local...");
                await supabase.auth.signOut();
                localStorage.clear(); // Brute force clean session from Vite
                setFase('auth'); // Joga de volta pra digitar e-mail e criar a conta do zero
                return;
            }

            if (profile.igreja_id) {
                // Já tem igreja? Vai pro App normal
                navigate('/roteiro');
            } else {
                // Tem perfil real, mas não tem igreja (Pessoa recém cadastrada na Fase 2)
                setFase('codigo');
            }
        } catch (err) {
            console.error("Erro catched ao rotear:", err);
            setFase('codigo');
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
                    await rotearUsuarioLogado(data.user.id);
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
                    await rotearUsuarioLogado(data.user.id);
                }
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'Erro ao autenticar. Verifique seus dados.');
            setLoading(false);
        }
    };

    // FASE 2: Voluntário digita o Código que o Pastor deu
    const handleEntrarComCodigo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!codigoConvite.trim()) return;

        setLoading(true);
        setErrorMsg('');

        try {
            // Chama a RPC (Stored Procedure) criada no banco que faz o by-pass do RLS inicial
            const { data, error } = await supabase.rpc('entrar_na_igreja', { codigo: codigoConvite.toUpperCase().trim() });

            if (error) throw error;

            // Se rodou a RPC com sucesso, o Voluntário já tá linkado!
            if (data === true) {
                navigate('/roteiro'); // Uhuu, bem vindo!
            } else {
                throw new Error("Código inválido ou Igreja não existe.");
            }

        } catch (error: any) {
            console.error("Erro RPC:", error);
            setErrorMsg(error.message || 'Código inválido. Fale com seu Líder.');
        } finally {
            setLoading(false);
        }
    };

    // FASE 3: Líder quer cadastrar uma nova igreja no sistema (Novo Tenant)
    const handleCriarNovaIgreja = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nomeIgreja.trim()) return;

        setLoading(true);
        setErrorMsg('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            // Gerar um código aleatório (Ex: M4D-9A2X)
            const randomCode = 'M4D-' + Math.random().toString(36).substring(2, 6).toUpperCase();

            // 1. Chama a nova função RPC Atômica que já insere a Igreja e atualiza o Pastor na mesma transação:
            const { error: igrejaErr } = await supabase.rpc('criar_nova_igreja', {
                nome_igreja: nomeIgreja,
                codigo: randomCode
            });

            if (igrejaErr) {
                console.error("Erro RPC Igreja:", igrejaErr);
                throw new Error("Não foi possível processar a criação do seu Ministério. O código do erro: " + igrejaErr.message);
            }

            // 2. Sucesso Absoluto!
            navigate('/roteiro');

        } catch (error: any) {
            console.error("Erro Criar Igreja:", error);
            setErrorMsg(error.message || 'Erro ao criar o Ministério. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }


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

                    {/* FASE 1: AUTH (EMAIL E SENHA) */}
                    {fase === 'auth' && (
                        <>
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
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voluntario@igreja.com" required className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm font-medium" />
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
                        </>
                    )}

                    {/* FASE 2: VOLUNTÁRIO DIGITA CÓDIGO DA IGREJA */}
                    {fase === 'codigo' && (
                        <>
                            <div className="space-y-4 text-center md:text-left">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0 mb-6 border border-blue-500/20">
                                    <Building2 className="text-blue-600" size={32} />
                                </div>
                                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                                    Vincule-se à sua Igreja
                                </h2>
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                    Para acessar os roteiros, escalas e treinamentos, insira o <strong className="text-foreground">Código de Acesso</strong> fornecido pelo seu líder de mídia.
                                </p>
                            </div>

                            <form className="space-y-6 pt-4" onSubmit={handleEntrarComCodigo}>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <KeyRound className="absolute left-4 top-4 h-6 w-6 text-blue-500" />
                                        <input
                                            type="text"
                                            value={codigoConvite}
                                            onChange={(e) => setCodigoConvite(e.target.value.toUpperCase())}
                                            placeholder="Ex: IEQ1517"
                                            required
                                            className="w-full pl-14 pr-4 py-4 uppercase tracking-widest bg-white border-2 border-slate-200 rounded-2xl font-black text-xl text-center focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={loading || codigoConvite.length < 3} className="w-full py-4 bg-foreground hover:bg-neutral-800 active:scale-[0.98] text-white shadow-xl shadow-black/10 text-base font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                                    {loading ? 'Buscando congregação...' : 'Entrar na Igreja'}
                                </button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-border flex flex-col items-center justify-center gap-2 text-center">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">É o líder da Mídia da sua igreja?</span>
                                <button type="button" onClick={() => setFase('nova_igreja')} className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border bg-card text-foreground font-bold rounded-xl hover:bg-accent transition-colors">
                                    <Clapperboard size={18} />
                                    <span>Sou Líder, quero cadastrar Minha Igreja</span>
                                </button>
                            </div>

                            {/* CAIXA DE FUGA (ANTI-STUCK / BUG DE CACHE) */}
                            <div className="pt-6 mt-6 border-t border-border flex justify-center">
                                <button type="button" onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); setFase('auth'); }} className="text-sm font-bold text-muted-foreground hover:text-red-500 transition-colors">
                                    Entrar com outra conta
                                </button>
                            </div>
                        </>
                    )}

                    {/* FASE 3: LÍDER CADASTRANDO NOVA INSTÂNCIA */}
                    {fase === 'nova_igreja' && (
                        <>
                            <div className="space-y-4 text-center md:text-left relative">
                                <button onClick={() => setFase('codigo')} className="absolute -top-10 left-0 text-sm font-bold text-muted-foreground hover:text-foreground flex items-center gap-1">
                                    ← Voltar
                                </button>
                                <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0 mb-6 border border-purple-500/20">
                                    <Building2 className="text-purple-600" size={32} />
                                </div>
                                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                                    Cadastre seu Ministério
                                </h2>
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                    Você se tornará o <strong>Administrador Principal</strong>. Configure o nome da sua igreja para gerar o código de acesso para sua equipe.
                                </p>
                            </div>

                            <form className="space-y-6 pt-4" onSubmit={handleCriarNovaIgreja}>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold ml-1 text-muted-foreground">Nome Formal (Ex: Presbiteriana Central)</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={nomeIgreja}
                                            onChange={(e) => setNomeIgreja(e.target.value)}
                                            placeholder="Nome da Igreja..."
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-bold text-foreground"
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={loading || nomeIgreja.length < 3} className="w-full py-4 bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white shadow-xl shadow-purple-600/20 text-base font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                                    {loading ? 'Gerando Servidor...' : 'Criar Conta da Igreja'}
                                </button>
                            </form>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}
