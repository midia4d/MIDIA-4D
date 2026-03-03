import { BarChart3, Users, Eye, Heart, MessageCircle, ArrowUpRight, Share2, Globe, Edit, X, Loader2, Save } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Impacto() {
    const { user } = useOutletContext<{ user: any }>();

    // Lista mck de meses
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesAtual = meses[new Date().getMonth()];

    // Estado local
    const [activeMes, setActiveMes] = useState(mesAtual);
    const [metricas, setMetricas] = useState<any>(null);
    const [historicoMetricas, setHistoricoMetricas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal Admin
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ visualizacoes: 0, pessoas_alcancadas: 0, vidas_transformadas: 0, cortes_replicados: 0 });

    const fetchMetricas = async (mesBase: string) => {
        setIsLoading(true);

        // 1. Puxa métrica apenas do mês atual (Pros cards)
        const { data: dadosMes } = await supabase
            .from('metricas_impacto')
            .select('*')
            .eq('mes_referencia', mesBase)
            .limit(1)
            .single();

        if (dadosMes) {
            setMetricas(dadosMes);
            setFormData({
                visualizacoes: dadosMes.visualizacoes || 0,
                pessoas_alcancadas: dadosMes.pessoas_alcancadas || 0,
                vidas_transformadas: dadosMes.vidas_transformadas || 0,
                cortes_replicados: dadosMes.cortes_replicados || 0
            });
        } else {
            setMetricas(null);
            setFormData({ visualizacoes: 0, pessoas_alcancadas: 0, vidas_transformadas: 0, cortes_replicados: 0 });
        }

        // 2. Puxa histórico geral (Pro Gráfico Recharts)
        const { data: historico } = await supabase
            .from('metricas_impacto')
            .select('*');

        if (historico) {
            // Ordenar de acordo com o Array original de Meses para manter a cronologia logica de Jan -> Dez
            const ordenado = historico.sort((a, b) => meses.indexOf(a.mes_referencia) - meses.indexOf(b.mes_referencia));
            setHistoricoMetricas(ordenado);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        fetchMetricas(activeMes);
    }, [activeMes]);

    const handleSaveMetricas = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (metricas?.id) {
                // Atualiza mês existente
                const { error } = await supabase
                    .from('metricas_impacto')
                    .update({
                        visualizacoes: formData.visualizacoes,
                        pessoas_alcancadas: formData.pessoas_alcancadas,
                        vidas_transformadas: formData.vidas_transformadas,
                        cortes_replicados: formData.cortes_replicados,
                        updated_by: user.id
                    })
                    .eq('id', metricas.id);
                if (error) throw error;
            } else {
                // Insere novo mês
                const { error } = await supabase
                    .from('metricas_impacto')
                    .insert([{
                        mes_referencia: activeMes,
                        visualizacoes: formData.visualizacoes,
                        pessoas_alcancadas: formData.pessoas_alcancadas,
                        vidas_transformadas: formData.vidas_transformadas,
                        cortes_replicados: formData.cortes_replicados,
                        updated_by: user.id
                    }]);
                if (error) throw error;
            }
            await fetchMetricas(activeMes);
            setShowModal(false);
        } catch (error) {
            console.error("Erro ao salvar métricas:", error);
            alert("Erro ao salvar dados.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 relative">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Impacto Espiritual</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Métricas que importam. Você não transmite vídeo, você transmite vida.</p>
                </div>

                <div className="flex gap-4 items-center">
                    {user?.role === 'admin' && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
                        >
                            <Edit size={16} /> Atualizar {activeMes}
                        </button>
                    )}
                    <select
                        className="bg-card px-4 py-2.5 rounded-xl border border-border outline-none focus:border-blue-500 font-bold transition-colors cursor-pointer text-sm"
                        value={activeMes}
                        onChange={(e) => setActiveMes(e.target.value)}
                    >
                        {meses.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Metric Cards */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border border-blue-500/50 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
                        <Globe className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500" size={120} />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 font-bold text-blue-100 mb-2 uppercase tracking-wider text-xs">
                                <Eye size={16} /> Visualizações Totais
                            </div>
                            <div className="text-4xl font-black mb-1">{metricas?.visualizacoes?.toLocaleString('pt-BR') || 0}</div>
                            <div className="text-sm font-bold text-blue-300 flex items-center gap-1">
                                Retenção e alcance do {activeMes}
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-green-500/30 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-muted-foreground mb-2 uppercase tracking-wider text-xs">
                            <Users size={16} className="text-green-500" /> Pessoas Alcançadas
                        </div>
                        <div className="text-3xl font-black mb-1">{metricas?.pessoas_alcancadas?.toLocaleString('pt-BR') || 0}</div>
                        <div className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                            Público único nos cultos ao vivo
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-red-500/30 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-muted-foreground mb-2 uppercase tracking-wider text-xs">
                            <Heart size={16} className="text-red-500 fill-red-500/20" /> Vidas Transformadas
                        </div>
                        <div className="text-3xl font-black mb-1">{metricas?.vidas_transformadas?.toLocaleString('pt-BR') || 0}</div>
                        <div className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                            Decisões/Apelos registrados online
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-purple-500/30 transition-colors">
                        <div className="flex items-center gap-2 font-bold text-muted-foreground mb-2 uppercase tracking-wider text-xs">
                            <Share2 size={16} className="text-purple-500" /> Cortes Replicados
                        </div>
                        <div className="text-3xl font-black mb-1">{metricas?.cortes_replicados?.toLocaleString('pt-BR') || 0}</div>
                        <div className="text-sm font-bold text-muted-foreground flex items-center gap-1">
                            Shorts & Reels postados da live
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Testemunhos / Feedbacks */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <MessageCircle className="text-blue-500" /> Testemunhos Registrados
                        </h2>
                        <button className="text-xs font-bold text-blue-500 hover:underline">Ver todos</button>
                    </div>

                    <div className="space-y-4">
                        <div className="p-6 text-center text-sm font-bold text-muted-foreground border border-border border-dashed rounded-3xl">
                            Funcionalidade de inserção de Testemunhos Diretos em avaliação para Fase 2.
                        </div>
                    </div>
                </div>

                {/* Grafico Geral da Igreja */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BarChart3 className="text-blue-500" /> Crescimento Anual
                    </h2>

                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm h-full min-h-[400px] flex flex-col justify-center relative overflow-hidden">

                        {historicoMetricas.length < 2 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm p-6 text-center z-10">
                                <div className="bg-blue-600/10 text-blue-500 p-4 rounded-full mb-4 ring-1 ring-blue-500/20">
                                    <ArrowUpRight size={32} />
                                </div>
                                <h3 className="font-black text-xl tracking-tight text-foreground">Aguardando mais dados...</h3>
                                <p className="text-muted-foreground font-medium text-sm mt-2 max-w-xs">
                                    Adicione as métricas de pelo menos 2 meses diferentes no botão "Atualizar" para gerar o Gráfico de Crescimento.
                                </p>
                            </div>
                        ) : (
                            <div className="w-full h-full -ml-4 mt-4 relative z-0">
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart
                                        data={historicoMetricas}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorVisu" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorAlc" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                        <XAxis
                                            dataKey="mes_referencia"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, className: "fill-muted-foreground font-bold" }}
                                            tickFormatter={(value) => value.substring(0, 3)}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, className: "fill-muted-foreground font-bold" }}
                                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '1rem', fontWeight: 'bold' }}
                                            itemStyle={{ color: 'var(--foreground)' }}
                                            labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}
                                        />
                                        <Area
                                            type="monotone"
                                            name="Visualizações (Youtube)"
                                            dataKey="visualizacoes"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorVisu)"
                                            activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
                                        />
                                        <Area
                                            type="monotone"
                                            name="Pessoas Alcançadas"
                                            dataKey="pessoas_alcancadas"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorAlc)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Atualização de Métricas Admin */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-card w-full max-w-md border border-border shadow-2xl rounded-3xl p-6 relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                            <Edit className="text-blue-500" /> Abastecer Métricas
                        </h2>
                        <p className="text-sm text-muted-foreground font-medium mb-6">Mês Referência: <span className="text-foreground uppercase">{activeMes}</span></p>

                        <form onSubmit={handleSaveMetricas} className="space-y-4">

                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">Visualizações Totais (Youtube)</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    value={formData.visualizacoes}
                                    onChange={e => setFormData({ ...formData, visualizacoes: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-blue-500 transition-all text-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Alcance Único</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={formData.pessoas_alcancadas}
                                        onChange={e => setFormData({ ...formData, pessoas_alcancadas: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-green-500 transition-all text-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-muted-foreground mb-1">Vidas Alcançadas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={formData.vidas_transformadas}
                                        onChange={e => setFormData({ ...formData, vidas_transformadas: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-red-500 transition-all text-red-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">Cortes/Shorts Publicados (Mídia)</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    value={formData.cortes_replicados}
                                    onChange={e => setFormData({ ...formData, cortes_replicados: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium outline-none focus:border-purple-500 transition-all text-purple-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full mt-6 py-3.5 bg-foreground hover:bg-foreground/90 disabled:opacity-50 text-background font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {isSaving ? "Gravando no Banco..." : "Publicar Placar Mensal"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
