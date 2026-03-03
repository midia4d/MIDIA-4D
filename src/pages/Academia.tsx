import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Video, FileText, Play, X, Trash2, Edit3, Loader2, CheckCircle, Circle, Star, Folder } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOutletContext } from 'react-router-dom';

export default function Academia() {
    // Pegando o `user` do layout, pra saber se é Admin
    const { user } = useOutletContext<{ user: any }>();

    // States de Dados
    const [modulos, setModulos] = useState<any[]>([]);
    const [aulas, setAulas] = useState<any[]>([]);
    const [progressoUser, setProgressoUser] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Navegação Interna
    const [moduloAtivo, setModuloAtivo] = useState<any | null>(null);

    // Modal de Assitir Aula
    const [aulaAberta, setAulaAberta] = useState<any | null>(null);
    const [userRating, setUserRating] = useState(0); // Para o momento da aula

    // Modais de Criar/Editar (Painel Admin)
    const [isEditModuloOpen, setIsEditModuloOpen] = useState(false);
    const [editModuloForm, setEditModuloForm] = useState<any>({ titulo: '', descricao: '', capa_url: '' });

    const [isEditAulaOpen, setIsEditAulaOpen] = useState(false);
    const [editAulaForm, setEditAulaForm] = useState<any>({ titulo: '', descricao: '', video_url: '', pdf_url: '', modulo_id: null });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        // Busca Módulos
        const { data: modulosData } = await supabase.from('treinamento_modulos').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: false });

        // Busca Aulas
        const { data: aulasData } = await supabase.from('treinamentos').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: false });

        // Busca Progresso do Usuário
        const { data: progData } = await supabase.from('treinamentos_progresso').select('*').eq('membro_id', user?.id);

        setModulos(modulosData || []);
        setAulas(aulasData || []);
        setProgressoUser(progData || []);
        setIsLoading(false);
    };

    useEffect(() => {
        if (user?.id) fetchData();
    }, [user?.id]);

    // Helpers
    const getYouTubeEmbedUrl = (url: string) => {
        if (!url) return '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = (match && match[2].length === 11) ? match[2] : null;
        if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`;
        return url;
    };

    // --- CONTROLES DE PROGRESSO DO ALUNO ---
    const getProgressoLocal = (aulaId: string) => progressoUser.find(p => p.treinamento_id === aulaId);

    const toggleAulaConcluida = async (aulaId: string) => {
        if (!user?.id) return;
        const prog = getProgressoLocal(aulaId);
        const newState = !(prog?.concluido || false);

        // Atualiza local para resposta imediata UI
        let newProgressoArr = [...progressoUser];
        if (prog) {
            newProgressoArr = newProgressoArr.map(p => p.treinamento_id === aulaId ? { ...p, concluido: newState, data_conclusao: newState ? new Date().toISOString() : null } : p);
        } else {
            newProgressoArr.push({ membro_id: user.id, treinamento_id: aulaId, concluido: newState, avaliacao: null, data_conclusao: new Date().toISOString() } as any);
        }
        setProgressoUser(newProgressoArr);

        // Atualiza DB via Função RPC Gamificada (dá +15XP na 1ª vez e avisa o Sininho)
        try {
            const { data, error } = await supabase.rpc('concluir_treinamento_com_xp', {
                p_treinamento_id: aulaId,
                p_concluido: newState
            });

            if (error) {
                console.error("Erro RPC Gamificação Aula:", error);
                throw error;
            }

            // O Feedback visual de Toast será coberto pela Navbar que escuta a tabela de Notificações via Websocket
            if (data?.status === 'sucesso_xp') {
                console.log("Ganhou XP!", data.xp_adicionado);
            }

        } catch (e) {
            console.error("Rollback de Aula após falha.");
            fetchData(); // Rollback if error
        }
    };

    const rateAula = async (aulaId: string, estrelas: number) => {
        if (!user?.id) return;
        setUserRating(estrelas);
        const prog = getProgressoLocal(aulaId);

        let newProgressoArr = [...progressoUser];
        if (prog) {
            newProgressoArr = newProgressoArr.map(p => p.treinamento_id === aulaId ? { ...p, avaliacao: estrelas } : p);
        } else {
            newProgressoArr.push({ membro_id: user.id, treinamento_id: aulaId, concluido: false, avaliacao: estrelas });
        }
        setProgressoUser(newProgressoArr);

        try {
            if (prog?.id) {
                await supabase.from('treinamentos_progresso').update({ avaliacao: estrelas }).eq('id', prog.id);
            } else {
                await supabase.from('treinamentos_progresso').insert({ membro_id: user.id, treinamento_id: aulaId, concluido: false, avaliacao: estrelas });
            }
        } catch (e) {
            fetchData();
        }
    };


    // --- CRUD DO ADMIN ---

    // Módulos
    const handleSaveModulo = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editModuloForm.id) {
                await supabase.from('treinamento_modulos').update({ titulo: editModuloForm.titulo, descricao: editModuloForm.descricao, capa_url: editModuloForm.capa_url }).eq('id', editModuloForm.id);
            } else {
                await supabase.from('treinamento_modulos').insert({ titulo: editModuloForm.titulo, descricao: editModuloForm.descricao, capa_url: editModuloForm.capa_url });
            }
            setIsEditModuloOpen(false);
            fetchData();
        } catch (error: any) { alert('Erro: ' + error.message); } finally { setIsSubmitting(false); }
    };

    const handleDeleteModulo = async (id: string, titulo: string) => {
        if (!window.confirm(`Apagar o Módulo "${titulo}" removerá TODAS as aulas dentro dele! Confirma?`)) return;
        await supabase.from('treinamento_modulos').delete().eq('id', id);
        if (moduloAtivo?.id === id) setModuloAtivo(null);
        fetchData();
    };

    // Aulas
    const handleSaveAula = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = {
                titulo: editAulaForm.titulo,
                descricao: editAulaForm.descricao,
                modulo_id: editAulaForm.modulo_id, // Pode ser null se for solto (antigas)
                video_url: editAulaForm.video_url,
                pdf_url: editAulaForm.pdf_url,
                created_by: user?.id
            };

            if (editAulaForm.id) {
                await supabase.from('treinamentos').update(payload).eq('id', editAulaForm.id);
            } else {
                await supabase.from('treinamentos').insert(payload);
            }
            setIsEditAulaOpen(false);
            fetchData();
        } catch (error: any) { alert('Erro: ' + error.message); } finally { setIsSubmitting(false); }
    };

    const handleDeleteAula = async (id: string, titulo: string) => {
        if (!window.confirm(`Apagar a aula "${titulo}"?`)) return;
        await supabase.from('treinamentos').delete().eq('id', id);
        setAulas(aulas.filter(a => a.id !== id));
    };

    // Views Helpers
    const aulasDoModuloAtivo = aulas.filter(a => moduloAtivo ? a.modulo_id === moduloAtivo.id : true); // Se sem módulo, exibe tudo? Ou só as soltas? Vamos exibir as do módulo, se não tiver modulo ativo, exibe módulos.

    // Calculadora Física do Módulo (Progresso Geral)
    const getModuloProgress = (modId: string) => {
        const aulasDeste = aulas.filter(a => a.modulo_id === modId);
        if (aulasDeste.length === 0) return 0;
        const concluidas = aulasDeste.filter(a => getProgressoLocal(a.id)?.concluido).length;
        return Math.round((concluidas / aulasDeste.length) * 100);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

            {/* HEADER HUB E-LEARNING */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-8 rounded-3xl shadow-xl shadow-blue-900/20 relative mx-4 md:mx-0">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm shadow-inner text-blue-300">
                            {moduloAtivo ? (
                                <button onClick={() => setModuloAtivo(null)} className="hover:text-white transition flex items-center gap-1 group">
                                    <BookOpen size={24} /> <span className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity -ml-2">Voltar</span>
                                </button>
                            ) : (
                                <BookOpen size={24} />
                            )}
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">
                            {moduloAtivo ? moduloAtivo.titulo : 'Academia Mídia 4D'}
                        </h1>
                    </div>
                    <p className="text-blue-100/80 font-medium max-w-lg">
                        {moduloAtivo ? moduloAtivo.descricao || 'Aulas deste módulo.' : 'Base de conhecimento oficial e onboarding. Acesse trilhas de treinamento e evolução técnica.'}
                    </p>
                </div>

                {/* Área de Admin */}
                {user?.role === 'admin' && (
                    <div className="relative z-10 flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        {!moduloAtivo && (
                            <button
                                onClick={() => { setEditModuloForm({ titulo: '', descricao: '', capa_url: '' }); setIsEditModuloOpen(true); }}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 whitespace-nowrap">
                                <Folder size={18} /> Criar Módulo
                            </button>
                        )}
                        <button
                            onClick={() => { setEditAulaForm({ titulo: '', descricao: '', modulo_id: moduloAtivo?.id || null, video_url: '', pdf_url: '' }); setIsEditAulaOpen(true); }}
                            className="bg-white text-blue-900 px-4 py-3 rounded-xl font-extrabold shadow-lg hover:bg-blue-50 transition-colors flex items-center gap-2 whitespace-nowrap">
                            <Video size={18} /> Adicionar Aula
                        </button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
            ) : (
                <div className="mx-4 md:mx-0">

                    {/* VISÃO 1: LISTA DE MÓDULOS (Dashboard Principal) */}
                    {!moduloAtivo && (
                        <div className="space-y-6">
                            {/* Sessão: Trilhas de Ensino (Módulos) */}
                            {modulos.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg mb-4 text-muted-foreground flex items-center gap-2"><Folder size={18} className="text-blue-500" /> Trilhas de Conhecimento</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {modulos.map(mod => {
                                            const pct = getModuloProgress(mod.id);
                                            return (
                                                <div key={mod.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col relative cursor-pointer" onClick={() => setModuloAtivo(mod)}>

                                                    {/* Thumb do Módulo */}
                                                    <div className="h-32 bg-gradient-to-br from-indigo-900 to-blue-800 relative p-6 flex flex-col justify-end">
                                                        {mod.capa_url && <img src={mod.capa_url} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay group-hover:opacity-50 transition-opacity" alt="Capa" />}
                                                        <h3 className="font-black text-xl text-white relative z-10 drop-shadow-md">{mod.titulo}</h3>
                                                    </div>

                                                    <div className="p-5 flex-1 flex flex-col justify-between">
                                                        <p className="text-sm text-muted-foreground line-clamp-2">{mod.descricao || 'Módulo de treinamento.'}</p>

                                                        <div className="mt-4 pt-4 border-t border-border/50">
                                                            <div className="flex justify-between text-xs font-bold mb-1.5">
                                                                <span className="text-muted-foreground">Progresso</span>
                                                                <span className={pct === 100 ? 'text-green-500' : 'text-blue-500'}>{pct}%</span>
                                                            </div>
                                                            <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                                                                <div className={cn("h-full transition-all duration-1000", pct === 100 ? 'bg-green-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Admin Modulo Controls */}
                                                    {user?.role === 'admin' && (
                                                        <div className="absolute top-2 right-2 flex gap-1 z-20" onClick={e => e.stopPropagation()}>
                                                            <button onClick={() => { setEditModuloForm(mod); setIsEditModuloOpen(true); }} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm"><Edit3 size={14} /></button>
                                                            <button onClick={() => handleDeleteModulo(mod.id, mod.titulo)} className="p-2 bg-black/50 hover:bg-red-500/80 text-white rounded-lg backdrop-blur-sm"><Trash2 size={14} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Sessão: Aulas Avulsas (Fora de módulos ou retrocompatibilidade) */}
                            {aulas.filter(a => !a.modulo_id).length > 0 && (
                                <div className="pt-8">
                                    <h3 className="font-bold text-lg mb-4 text-muted-foreground flex items-center gap-2"><Video size={18} className="text-blue-500" /> Aulas Individuais</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {/* Renderiza Aulas Soltas */}
                                        {aulas.filter(a => !a.modulo_id).map(aula => RenderAulaCard(aula, user, getProgressoLocal, handleDeleteAula, setEditAulaForm, setIsEditAulaOpen, setAulaAberta, toggleAulaConcluida))}
                                    </div>
                                </div>
                            )}

                            {modulos.length === 0 && aulas.filter(a => !a.modulo_id).length === 0 && (
                                <div className="py-24 text-center border-2 border-dashed border-border rounded-3xl bg-card">
                                    <Video size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                                    <h3 className="text-xl font-bold text-foreground">A Academia está vazia</h3>
                                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Nenhum módulo ou aula foi cadastrado ainda.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VISÃO 2: DENTRO DE UM MÓDULO */}
                    {moduloAtivo && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {aulasDoModuloAtivo.length === 0 ? (
                                <div className="col-span-full py-24 text-center rounded-3xl bg-card border border-border">
                                    <p className="text-muted-foreground">Este módulo ainda não possui aulas cadastradas.</p>
                                </div>
                            ) : (
                                aulasDoModuloAtivo.map(aula => RenderAulaCard(aula, user, getProgressoLocal, handleDeleteAula, setEditAulaForm, setIsEditAulaOpen, setAulaAberta, toggleAulaConcluida))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================== */}
            {/* OVERLAYS E MODAIS                                        */}
            {/* ========================================================== */}

            {/* MODAL DO PLAYER DE VÍDEO (THEATER MODE) WITH RATING */}
            {aulaAberta && (
                <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-[70] flex flex-col animate-in fade-in overflow-y-auto">

                    {/* Header do Cinema */}
                    <div className="flex items-center justify-between p-4 md:px-8 md:py-6 border-b border-border/10 shrink-0">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-1">Assistindo Aula</div>
                            <h2 className="text-xl md:text-2xl font-black text-foreground pr-8">{aulaAberta.titulo}</h2>
                        </div>
                        <button
                            onClick={() => {
                                setAulaAberta(null);
                                setUserRating(0);
                            }}
                            className="w-12 h-12 rounded-full flex-shrink-0 bg-accent/50 text-foreground flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Tela / Iframe (Resolvido overflow e aspect ratio perfeito) */}
                    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 flex items-center justify-center relative shrink-0">
                        <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20 bg-black" style={{ paddingTop: '56.25%' }}>
                            <iframe
                                className="absolute inset-0 w-full h-full"
                                src={getYouTubeEmbedUrl(aulaAberta.video_url)}
                                title={aulaAberta.titulo}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </div>

                    {/* Rodapé com Conclusão, Rating e Infos Extra */}
                    <div className="max-w-5xl mx-auto w-full p-4 md:p-8 pt-0 pb-12 shrink-0 space-y-4">

                        {/* Gamificação Bar: Conclusão & Estrelas */}
                        <div className="bg-card border border-border/50 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                            <button
                                onClick={() => toggleAulaConcluida(aulaAberta.id)}
                                className={cn(
                                    "flex items-center gap-3 px-6 py-4 w-full md:w-auto rounded-xl font-bold transition-all text-lg border-2",
                                    getProgressoLocal(aulaAberta.id)?.concluido
                                        ? "bg-green-500/10 border-green-500 text-green-600 shadow-inner"
                                        : "bg-surface border-border text-foreground hover:border-blue-500/50 hover:bg-blue-500/5"
                                )}
                            >
                                {getProgressoLocal(aulaAberta.id)?.concluido ? <CheckCircle size={24} className="fill-current" /> : <Circle size={24} className="text-muted-foreground" />}
                                Marcar como Concluída
                            </button>

                            <div className="flex flex-col items-center md:items-end w-full md:w-auto">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Avalie este conteúdo</span>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        const currentRating = userRating || getProgressoLocal(aulaAberta.id)?.avaliacao || 0;
                                        return (
                                            <button
                                                key={star}
                                                onClick={() => rateAula(aulaAberta.id, star)}
                                                className="p-1 hover:scale-110 transition-transform"
                                            >
                                                <Star
                                                    size={28}
                                                    className={cn(
                                                        "transition-colors",
                                                        star <= currentRating ? "text-yellow-400 fill-current" : "text-muted-foreground/30 fill-transparent"
                                                    )}
                                                />
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Material de Apoio e Desc */}
                        {(aulaAberta.descricao || aulaAberta.pdf_url) && (
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                                <h4 className="font-bold text-lg mb-2 flex items-center gap-2"><BookOpen className="text-blue-500" size={18} /> Descrição e Material de Apoio</h4>
                                <p className="text-muted-foreground whitespace-pre-line text-sm md:text-base leading-relaxed">{aulaAberta.descricao}</p>

                                {aulaAberta.pdf_url && (
                                    <div className="mt-6 pt-6 border-t border-border/50">
                                        <a href={aulaAberta.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-full md:w-auto gap-2 px-6 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">
                                            <FileText size={18} /> Acessar Link Externo / PDF
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAIS DE CMS - SCROLL ARRUMADO NAS CAIXAS MAIORES */}
            {/* Modal: CRIAR MÓDULO */}
            {isEditModuloOpen && user?.role === 'admin' && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-accent/20 shrink-0">
                            <h2 className="text-xl font-black">{editModuloForm.id ? 'Editar Módulo' : 'Novo Módulo de Ensino'}</h2>
                            <button onClick={() => setIsEditModuloOpen(false)} className="p-2 text-muted-foreground hover:bg-accent rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="overflow-y-auto p-6">
                            <form id="modForm" onSubmit={handleSaveModulo} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Nome do Módulo</label>
                                    <input required value={editModuloForm.titulo} onChange={e => setEditModuloForm({ ...editModuloForm, titulo: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Formação em Câmeras" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Descrição</label>
                                    <textarea value={editModuloForm.descricao || ''} onChange={e => setEditModuloForm({ ...editModuloForm, descricao: e.target.value })} className="w-full bg-background border border-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24" placeholder="Visão geral do que eles vão aprender" />
                                </div>
                                <div className="space-y-2 relative">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Link de Imagem para Capa (Apenas URL)</label>
                                    <input type="url" value={editModuloForm.capa_url || ''} onChange={e => setEditModuloForm({ ...editModuloForm, capa_url: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://..." />
                                </div>
                            </form>
                        </div>
                        <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0 bg-accent/10">
                            <button type="button" onClick={() => setIsEditModuloOpen(false)} className="px-5 py-2.5 bg-card text-foreground font-bold rounded-xl border border-border hover:bg-accent">Cancelar</button>
                            <button type="submit" form="modForm" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 flex items-center gap-2">
                                {isSubmitting ? 'Salvando...' : 'Salvar Módulo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: CRIAR AULA */}
            {isEditAulaOpen && user?.role === 'admin' && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-card rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-accent/20 shrink-0">
                            <h2 className="text-xl font-black">{editAulaForm.id ? 'Editar Aula' : 'Publicar Nova Aula'}</h2>
                            <button onClick={() => setIsEditAulaOpen(false)} className="p-2 text-muted-foreground hover:bg-accent rounded-lg"><X size={20} /></button>
                        </div>

                        <div className="overflow-y-auto p-6">
                            <form id="aulaForm" onSubmit={handleSaveAula} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Título da Aula</label>
                                        <input required value={editAulaForm.titulo} onChange={e => setEditAulaForm({ ...editAulaForm, titulo: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Como ligar o painel de LED" />
                                    </div>

                                    {/* Select Sub-modulo em vez de input texto solto */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Vincular a qual Módulo?</label>
                                        <div className="relative">
                                            <Folder size={18} className="absolute left-3 top-3.5 text-blue-500" />
                                            <select
                                                value={editAulaForm.modulo_id || ''}
                                                onChange={e => setEditAulaForm({ ...editAulaForm, modulo_id: e.target.value || null })}
                                                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                            >
                                                <option value="">Apenas uma Aula Avulsa / Sem Módulo</option>
                                                {modulos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2 md:col-span-2 relative">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Play size={14} className="text-blue-500" /> URL do Youtube</label>
                                        <input type="url" value={editAulaForm.video_url || ''} onChange={e => setEditAulaForm({ ...editAulaForm, video_url: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://youtube.com/watch?v=..." />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Descrição</label>
                                        <textarea value={editAulaForm.descricao || ''} onChange={e => setEditAulaForm({ ...editAulaForm, descricao: e.target.value })} className="w-full bg-background border border-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24" placeholder="Descreva o passo a passo..." />
                                    </div>

                                    <div className="space-y-2 md:col-span-2 relative">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><FileText size={14} className="text-indigo-500" /> Link de Material Complementar (PDF/Drive)</label>
                                        <input type="url" value={editAulaForm.pdf_url || ''} onChange={e => setEditAulaForm({ ...editAulaForm, pdf_url: e.target.value })} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Link externo do material" />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0 bg-accent/10">
                            <button type="button" onClick={() => setIsEditAulaOpen(false)} className="px-6 py-3 bg-card border border-border text-foreground font-bold rounded-xl hover:bg-accent transition-colors">Cancelar</button>
                            <button type="submit" form="aulaForm" disabled={isSubmitting} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2">
                                {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                                {isSubmitting ? 'Salvando...' : 'Publicar Aula'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-componente para evitar duplicação no card da Aula
function RenderAulaCard(aula: any, user: any, getProgressoLocal: any, handleDeleteAula: any, setEditAulaForm: any, setIsEditAulaOpen: any, setAulaAberta: any, toggleConclusao: any) {
    const prog = getProgressoLocal(aula.id);
    const isConcluida = prog?.concluido;
    const rating = prog?.avaliacao || 0;

    return (
        <div key={aula.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:border-blue-500/30 group flex flex-col">
            {/* Thumb */}
            <div
                className="h-40 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 relative flex items-center justify-center border-b border-border/50 group-hover:from-indigo-500/20 group-hover:to-blue-500/20 transition-colors cursor-pointer"
                onClick={() => { if (aula.video_url) setAulaAberta(aula); }}
            >
                {aula.video_url ? (
                    <>
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                        <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-blue-600 shadow-xl scale-95 group-hover:scale-110 transition-transform">
                            <Play className="ml-1" size={24} fill="currentColor" />
                        </div>
                    </>
                ) : <FileText size={48} className="text-blue-500/30" />}

                {/* Status Badge */}
                {isConcluida && (
                    <div className="absolute top-4 left-4 bg-green-500/90 backdrop-blur text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-green-400 flex items-center gap-1 shadow-md">
                        <CheckCircle size={12} className="fill-current text-green-200" /> Assistida
                    </div>
                )}
            </div>

            {/* Content Baixo */}
            <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-extrabold text-lg line-clamp-2 leading-tight group-hover:text-blue-500 transition-colors flex-1">{aula.titulo}</h3>
                    {/* Stars Small Display */}
                    {rating > 0 && (
                        <div className="flex bg-yellow-400/10 px-1.5 py-0.5 rounded-full items-center">
                            <Star size={12} className="text-yellow-500 fill-current" />
                            <span className="text-[10px] font-bold text-yellow-600 ml-1">{rating}</span>
                        </div>
                    )}
                </div>

                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed flex-1">{aula.descricao}</p>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleConclusao(aula.id); }}
                        className={cn("p-2 rounded-xl border transition-colors", isConcluida ? "bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20" : "bg-card border-border text-muted-foreground hover:bg-accent")}
                        title={isConcluida ? "Marcar como não lida" : "Marcar como concluída"}
                    >
                        {isConcluida ? <CheckCircle size={18} className="fill-current" /> : <Circle size={18} />}
                    </button>

                    {user?.role === 'admin' && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setEditAulaForm(aula); setIsEditAulaOpen(true); }} className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"><Edit3 size={16} /></button>
                            <button onClick={() => handleDeleteAula(aula.id, aula.titulo)} className="p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
