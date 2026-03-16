"""
Patch dashboard/page.tsx to replace the JSX return block from line 681 onwards.
"""

FILEPATH = r"c:\Users\takou\Documents\maplebudget\apps\web\src\app\dashboard\page.tsx"

with open(FILEPATH, "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find the return statement start (around line 681)
return_line = None
for i, line in enumerate(lines):
    if "return (" in line and i > 670:
        return_line = i
        print(f"Found return( at line {i+1}: {repr(line[:60])}")
        break

if return_line is None:
    print("Could not find return(")
    exit(1)

# Keep everything before the return
header = lines[:return_line]

# New JSX return block
new_jsx = '''  return (
    <main className="space-y-10 pb-16">

      {/* Hero Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-fade-in-up">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="mb-badge bg-blue-500/10 border-blue-500/20 text-blue-300">Dashboard</span>
            <span className="mb-badge">Signal: {signal.label}</span>
            <span className="mb-badge">{fromDate && toDate ? `${fromDate} → ${toDate}` : "Toutes dates"}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-4">Vue rapide</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <BankConnectButton onConnectSuccess={loadAll} />
          <button className="mb-btn gap-2" onClick={loadAll} disabled={loading}>
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Chargement\u2026" : "Rafra\u00eechir"}
          </button>
          <Link className="mb-btn mb-btn-primary gap-2" href="/transactions">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            G\u00e9rer transactions
          </Link>
        </div>
      </section>

      {/* Error */}
      {err && (
        <div className="rounded-2xl p-5 border border-red-500/30 bg-red-500/10 animate-fade-in-up">
          <div className="font-semibold text-red-100">Erreur</div>
          <div className="text-sm opacity-80 mt-1 text-red-200">{err}</div>
          <div className="mt-4">
            <Link className="mb-btn mb-btn-primary" href="/login">Se connecter</Link>
          </div>
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4 animate-fade-in-up delay-100">
        <KPI label="Revenus" value={money(totals.income)} hint="selon filtres" tone="good" />
        <KPI label="D\u00e9penses" value={money(totals.expense)} hint="selon filtres" tone="warn" />
        <KPI label="Net" value={money(totals.net)} hint={`Signal: ${signal.label}`} tone={signal.tone} />
        <KPI label="Transactions" value={num(totals.count)} hint="dans la p\u00e9riode" tone="neutral" />
      </section>

      {/* Quick Date Filters */}
      <section className="rounded-2xl bg-black/30 border border-white/[0.06] p-4 animate-fade-in-up delay-150">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-semibold opacity-50 shrink-0 uppercase tracking-widest">P\u00e9riode</span>
          <div className="flex flex-wrap gap-2">
            {([30, 60, 90, "all"] as const).map((d) => {
              const active = activeDateFilter === d;
              return (
                <button
                  key={String(d)}
                  onClick={() => setDateRange(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    active
                      ? "bg-white/12 text-white border-white/25 shadow-[0_0_10px_rgba(255,255,255,0.06)]"
                      : "bg-transparent text-white/40 border-white/8 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  {d === "all" ? "Tout" : `${d}j`}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Forecast */}
      {forecast && (
        <section className="rounded-2xl p-7 relative overflow-hidden bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.10)] animate-fade-in-up delay-200">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/12 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/12 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-white/8 rounded-xl border border-indigo-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent">
                  Nexus IA \u2014 Pr\u00e9vision Cash-Flow
                </h2>
                <p className="text-xs opacity-50 mt-0.5">{money(forecast.run_rate)}/jour \u00b7 {forecast.remaining_days} jours restants</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-5 bg-black/30 rounded-xl border border-white/[0.06]">
                <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">D\u00e9penses Projet\u00e9es</div>
                <div className="text-2xl font-bold mt-2">{money(forecast.projected_expenses)}</div>
                <div className="text-xs opacity-40 mt-1">D&apos;ici fin du mois</div>
              </div>
              <div className="p-5 bg-black/30 rounded-xl border border-white/[0.06]">
                <div className="text-xs font-semibold opacity-50 uppercase tracking-wider">Revenus Confirm\u00e9s</div>
                <div className="text-2xl font-bold mt-2">{money(forecast.current_income)}</div>
                <div className="text-xs opacity-40 mt-1">Acquis ce mois-ci</div>
              </div>
              <div className={`p-5 rounded-xl border ${forecast.projected_net >= 0 ? "border-green-500/25 bg-green-500/8" : "border-red-500/25 bg-red-500/8"}`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${forecast.projected_net >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Solde Pr\u00e9vu
                </div>
                <div className={`text-2xl font-bold mt-2 ${forecast.projected_net >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {forecast.projected_net > 0 ? "+" : ""}{money(forecast.projected_net)}
                </div>
                <div className="text-xs opacity-60 mt-1">
                  {forecast.projected_net >= 0 ? "Excellent rythme !" : `Risque d\u00e9ficit dans ${forecast.remaining_days}j`}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Advanced Filters + Chart */}
      <section className="grid gap-6 lg:grid-cols-12 animate-fade-in-up delay-300">
        <div className="lg:col-span-4 rounded-2xl bg-black/30 border border-white/[0.06] p-5">
          <div className="text-xs font-semibold opacity-50 uppercase tracking-widest mb-4">Filtres avanc\u00e9s</div>
          <div className="grid gap-3">
            <label className="text-sm opacity-70">
              D\u00e9but
              <input className="mb-input mt-1.5" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="text-sm opacity-70">
              Fin
              <input className="mb-input mt-1.5" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <label className="text-sm opacity-70">
              Type
              <select className="mb-input mt-1.5" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "income" | "expense")}>
                <option value="all">Tous</option>
                <option value="income">Revenus</option>
                <option value="expense">D\u00e9penses</option>
              </select>
            </label>
            <label className="text-sm opacity-70">
              Graphique
              <select className="mb-input mt-1.5" value={mode} onChange={(e) => setMode(e.target.value as "net" | "income" | "expense")}>
                <option value="net">Net</option>
                <option value="income">Revenus</option>
                <option value="expense">D\u00e9penses</option>
              </select>
            </label>
            <button
              className="mb-btn w-full mt-1"
              onClick={() => { setDateRange("all"); setTypeFilter("all"); setMode("net"); }}
            >
              R\u00e9initialiser
            </button>
          </div>
        </div>
        <div className="lg:col-span-8">
          <TrendChart series={series} mode={mode} />
        </div>
      </section>

      {/* Budget & Categories */}
      <section className="rounded-2xl bg-black/30 border border-white/[0.06] p-6 animate-fade-in-up delay-400">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-base font-semibold">Budgets &amp; Cat\u00e9gories</div>
            <div className="text-xs opacity-50 mt-0.5">Suivi de la consommation par cat\u00e9gorie</div>
          </div>
          <span className="mb-badge">{byCategory.length} cat\u00e9gorie(s)</span>
        </div>

        {byCategory.length > 0 && (
          <div className="mb-6 flex justify-center">
            <DonutChart
              data={byCategory.slice(0, 8).map((c, i) => {
                const palette = ["#6366f1","#eab308","#ef4444","#06b6d4","#f97316","#8b5cf6","#10b981","#ec4899"];
                return {
                  id: i,
                  label: c.name,
                  value: Math.abs(c.total),
                  color: c.type === "income" ? "#22c55e" : palette[i % palette.length],
                };
              })}
              centerTextTop="Top 8"
              centerTextBottom={money(byCategory.slice(0, 8).reduce((acc, c) => acc + Math.abs(c.total), 0))}
            />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {byCategory.map((c, idx) => {
            const consumed = Math.abs(c.total);
            const limit = c.budget_limit || 0;
            const hasLimit = limit > 0 && c.type === "expense";
            let w = 0;
            if (hasLimit) {
              w = Math.min((consumed / limit) * 100, 100);
            } else {
              const max = Math.max(...byCategory.map((x) => Math.abs(x.total)), 1);
              w = (consumed / max) * 100;
            }
            let barColor = "rgba(234,179,8,0.5)";
            if (c.type === "income") barColor = "rgba(34,197,94,0.6)";
            else if (hasLimit) {
              barColor = w >= 90 ? "rgba(239,68,68,0.7)" : w >= 75 ? "rgba(234,179,8,0.7)" : "rgba(34,197,94,0.7)";
            }
            return (
              <div key={idx} className="rounded-2xl p-5 bg-black/30 border border-white/5 hover:border-white/10 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs opacity-50 mt-0.5 uppercase tracking-wider">
                      {c.type === "income" ? "Revenus" : "D\u00e9penses"} \u00b7 {num(c.count)} tx
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-lg">{money(consumed)}</div>
                    {hasLimit && (
                      <div className="text-xs opacity-50 mt-0.5">/ {money(limit)}</div>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${w}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
                  />
                </div>
                {hasLimit && (
                  <div className="mt-1.5 text-xs opacity-40 text-right">{w.toFixed(0)}% utilis\u00e9</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
'''

# Write the new file
new_content = "".join(header) + new_jsx
with open(FILEPATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Done! Written {len(new_content.splitlines())} lines.")
