"use client";

import { useEffect, useMemo, useState } from "react";
import { getTransactions, Transaction } from "@/lib/api";
import { money } from "@/lib/format";
import { useExport } from "@/hooks/useExport";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

type DayData = {
  date: string;
  income: number;
  expense: number;
  txs: Transaction[];
};

export default function CalendarPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(new Date());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selected, setSelected] = useState<DayData | null>(null);
  const { loading: exporting, exportTransactions } = useExport();

  useEffect(() => {
    getTransactions()
      .then(setTxs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build day map for the current month
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const tx of txs) {
      if (!tx.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) continue;
      const d = map.get(tx.date) ?? { date: tx.date, income: 0, expense: 0, txs: [] };
      const isIncome = (tx.category as { type?: string })?.type === "income";
      if (isIncome) d.income += Number(tx.amount);
      else d.expense += Number(tx.amount);
      d.txs.push(tx);
      map.set(tx.date, d);
    }
    return map;
  }, [txs, year, month]);

  // Build calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    // Mon=0 ... Sun=6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthTotal = useMemo(() => {
    let income = 0, expense = 0;
    dayMap.forEach(d => { income += d.income; expense += d.expense; });
    return { income, expense, net: income - expense };
  }, [dayMap]);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <main className="animate-fade-in-up max-w-5xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Calendrier <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">des transactions</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Visualise tes dépenses jour par jour.</p>
        </div>
        <button
          onClick={() => {
            const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
            exportTransactions("csv", { date_from: firstDay, date_to: lastDay });
          }}
          disabled={exporting}
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {exporting ? "Export…" : "Exporter CSV"}
        </button>
      </div>

      {/* Résumé mensuel */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
          <div className="text-xs text-white/50 mb-1">Revenus</div>
          <div className="text-xl font-bold text-emerald-400">{money(monthTotal.income)}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
          <div className="text-xs text-white/50 mb-1">Dépenses</div>
          <div className="text-xl font-bold text-red-400">{money(monthTotal.expense)}</div>
        </div>
        <div className={`${monthTotal.net >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"} border rounded-2xl p-4 text-center`}>
          <div className="text-xs text-white/50 mb-1">Net</div>
          <div className={`text-xl font-bold ${monthTotal.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(monthTotal.net)}</div>
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5">
        {/* Navigation mois */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h2 className="text-lg font-semibold text-white">{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        {/* En-têtes jours */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs text-white/30 font-semibold py-1">{d}</div>
          ))}
        </div>

        {/* Grille */}
        {loading ? (
          <div className="text-center py-12 text-white/30 text-sm animate-pulse">Chargement...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              if (day === null) return <div key={i} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const data = dayMap.get(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = selected?.date === dateStr;
              const net = (data?.income ?? 0) - (data?.expense ?? 0);
              const hasData = !!data;

              return (
                <button
                  key={i}
                  onClick={() => setSelected(isSelected ? null : (data ?? null))}
                  className={[
                    "relative min-h-[56px] rounded-xl p-1.5 flex flex-col transition-all text-left",
                    isToday ? "ring-2 ring-violet-500/60" : "",
                    isSelected ? "bg-violet-500/20 border border-violet-500/30" : hasData ? "bg-white/5 hover:bg-white/10 border border-white/5" : "hover:bg-white/5 border border-transparent",
                  ].join(" ")}
                >
                  <span className={`text-xs font-semibold ${isToday ? "text-violet-400" : "text-white/60"}`}>{day}</span>
                  {hasData && (
                    <div className="mt-auto space-y-0.5">
                      {data!.income > 0 && (
                        <div className="text-[9px] text-emerald-400 font-medium truncate">+{money(data!.income)}</div>
                      )}
                      {data!.expense > 0 && (
                        <div className="text-[9px] text-red-400 font-medium truncate">-{money(data!.expense)}</div>
                      )}
                    </div>
                  )}
                  {/* Indicateur couleur */}
                  {hasData && (
                    <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${net >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Détail du jour sélectionné */}
      {selected && (
        <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-white/80 mb-3">
            Transactions du {selected.date}
            <span className="ml-2 text-xs text-white/40">({selected.txs.length} transaction{selected.txs.length > 1 ? "s" : ""})</span>
          </h3>
          <div className="space-y-2">
            {selected.txs.map(tx => {
              const cat = tx.category as { name?: string; type?: string } | undefined;
              const isIncome = cat?.type === "income";
              return (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <div className="text-sm text-white/80">{tx.note || cat?.name || "Transaction"}</div>
                    <div className="text-xs text-white/40">{cat?.name}</div>
                  </div>
                  <span className={`text-sm font-semibold ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                    {isIncome ? "+" : "-"}{money(Number(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-white/10 text-sm font-semibold">
            <span className="text-white/50">Net du jour</span>
            <span className={selected.income - selected.expense >= 0 ? "text-emerald-400" : "text-red-400"}>
              {money(selected.income - selected.expense)}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
