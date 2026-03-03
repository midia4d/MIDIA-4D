import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Disponibilidade() {
    const { user } = useOutletContext<{ user: any }>();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Estado do Banco de Dados
    const [availableDays, setAvailableDays] = useState<Date[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Buscar os dias no Supabase assim que a tela abre ou o mês muda (opcional, mas trazemos de tudo para simplificar)
    const fetchDisponibilidade = async () => {
        if (!user?.id) return;
        setIsLoading(true);

        const { data, error } = await supabase
            .from('disponibilidade')
            .select('data_disponivel')
            .eq('membro_id', user.id);

        if (error) {
            console.error("Erro ao buscar disponibilidade:", error);
        } else if (data) {
            // Converter as strings que vieram do BD para objetos Date reais do JS
            const datesDb = data.map(d => new Date(d.data_disponivel + "T00:00:00")); // Evita fuso horário adiantando dia
            setAvailableDays(datesDb);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchDisponibilidade();
    }, [user?.id]);

    const toggleDay = (day: Date) => {
        setAvailableDays((prev) => {
            const isSelected = prev.some((d) => isSameDay(d, day));
            if (isSelected) {
                return prev.filter((d) => !isSameDay(d, day));
            }
            return [...prev, day];
        });
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);

    // Pegar os dias do mês atual para o grid
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Dias da semana para o cabeçalho
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Pad the start of the month with empty days so the 1st falls on the correct week day
    const startDayOfWeek = monthStart.getDay();
    const paddingDays = Array.from({ length: startDayOfWeek }).map((_, i) => i);

    const handleSaveDisponibilidade = async () => {
        if (!user?.id) return;
        setIsSaving(true);

        try {
            // 1. O jeito mais seguro de atualizar: Deletar tudo DESSE usuário e Inserir tudo de novo. (Replace All)
            const { error: errorDelete } = await supabase
                .from('disponibilidade')
                .delete()
                .eq('membro_id', user.id);

            if (errorDelete) throw errorDelete;

            // 2. Se a lista nova não estiver vazia, insere
            if (availableDays.length > 0) {
                // Formatar para o padrão do BD (YYYY-MM-DD)
                const diasParaInserir = availableDays.map(d => ({
                    membro_id: user.id,
                    data_disponivel: format(d, 'yyyy-MM-dd')
                }));

                const { error: errorInsert } = await supabase
                    .from('disponibilidade')
                    .insert(diasParaInserir);

                if (errorInsert) throw errorInsert;
            }

            alert("Sua disponibilidade foi salva com sucesso e as Lideranças já podem ver seus dias!");
        } catch (error: any) {
            console.error("Erro ao salvar:", error);
            alert(`Erro ao salvar no banco de dados: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Disponibilidade Mensal</h1>
                    <p className="text-muted-foreground mt-1">
                        Selecione os dias em que você pode servir na mídia este mês.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-blue-500/10 text-blue-500 px-4 py-2 rounded-xl border border-blue-500/20 font-medium text-sm">
                    <CalendarIcon size={16} /> {availableDays.length} dias selecionados
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Calendario */}
                <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm">

                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black capitalize tracking-tight flex items-center gap-3">
                            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={prevMonth}
                                className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={nextMonth}
                                className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Weekdays Header */}
                    <div className="grid grid-cols-7 mb-4">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center text-sm font-bold text-muted-foreground tracking-wider uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2 md:gap-3">
                        {paddingDays.map((i) => (
                            <div key={`pad-${i}`} className="aspect-square" /> // Empty cells for padding
                        ))}

                        {daysInMonth.map((day, i) => {
                            const isSelected = availableDays.some((d) => isSameDay(d, day));
                            const today = isToday(day);

                            return (
                                <button
                                    key={i}
                                    onClick={() => toggleDay(day)}
                                    className={cn(
                                        "relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 font-bold text-lg",
                                        isSelected
                                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105"
                                            : "bg-background border-border text-foreground hover:border-blue-500/50 hover:bg-accent/50",
                                        today && !isSelected && "border-blue-500/50 text-blue-500"
                                    )}
                                >
                                    {format(day, 'd')}
                                    {isSelected && (
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                            <CheckCircle2 size={14} className="fill-current text-white" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-8 pt-6 border-t border-border flex justify-end">
                        <button
                            onClick={handleSaveDisponibilidade}
                            disabled={isSaving}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                            {isSaving ? "Sincronizando..." : "Salvar Disponibilidade"}
                        </button>
                    </div>
                </div>

                {/* Sidebar info */}
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 text-blue-500/10">
                            <AlertCircle size={100} />
                        </div>
                        <h3 className="text-lg font-bold mb-3 relative z-10 text-blue-500 flex items-center gap-2">
                            <AlertCircle size={20} /> Por que marcar?
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed relative z-10">
                            A organização da escala depende 100% da sua disponibilidade prévia.
                            Garantir que os dias marcados são dias em que você pode servir é o primeiro passo para a <strong className="text-foreground">Dedicação</strong> excelente.
                        </p>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <CalendarIcon size={20} className="text-green-500" /> Seus Dias Salvos
                        </h3>
                        {availableDays.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 bg-background rounded-xl border border-dashed border-border">
                                Nenhum dia selecionado
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {availableDays.sort((a, b) => a.getTime() - b.getTime()).map((day, i) => (
                                    <div key={i} className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1.5 rounded-lg text-sm font-bold">
                                        {format(day, "dd/MM")}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
