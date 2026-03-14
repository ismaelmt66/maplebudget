from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date as dt_date, datetime

from db import get_db
import models
import schemas
from auth import get_current_user
from services.ai_engine import FinancialAIEngine

router = APIRouter()


@router.get("/notifications", response_model=List[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    now_str = datetime.now().isoformat()
    today = dt_date.today().strftime("%Y-%m-%d")
    existing_today = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current.id, models.Notification.created_at >= today)
        .count()
    )
    if existing_today == 0:
        engine = FinancialAIEngine(db, current.id)
        for n in engine.generate_proactive_notifications():
            db.add(models.Notification(
                user_id=current.id, title=n["title"], body=n["body"],
                type=n["type"], is_read=False, created_at=now_str,
            ))
        db.commit()
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current.id)
        .order_by(models.Notification.created_at.desc())
        .limit(20)
        .all()
    )


@router.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notif_id, models.Notification.user_id == current.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current.id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.get("/reports/weekly", response_model=schemas.WeeklyReportOut)
def get_weekly_report(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from datetime import timedelta
    now = datetime.now()
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    existing = (
        db.query(models.WeeklyReport)
        .filter(models.WeeklyReport.user_id == current.id, models.WeeklyReport.week_start == week_start)
        .first()
    )
    if existing:
        return existing
    engine = FinancialAIEngine(db, current.id)
    report = models.WeeklyReport(
        user_id=current.id, week_start=week_start,
        content=engine.generate_weekly_report(), created_at=now.isoformat(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.post("/simulator/projection", response_model=schemas.SimulatorResult)
def simulate_projection(
    payload: schemas.SimulatorRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    # 1. Get user's current net worth
    assets = db.query(models.Asset).filter(models.Asset.user_id == current.id).all()
    net_worth = sum(a.balance if a.type != 'liability' else -a.balance for a in assets)

    # 2. Determine baseline monthly savings
    engine = FinancialAIEngine(db, current.id)
    curr_start, curr_end = engine._get_current_month_boundaries()
    curr = engine._get_monthly_stats(curr_start, curr_end)
    last_start, last_end = engine._get_last_month_boundaries()
    last = engine._get_monthly_stats(last_start, last_end)
    
    ref_income = curr["income"] if curr["income"] > 0 else last["income"]
    ref_expenses = curr["expenses"] if curr["expenses"] > 0 else last["expenses"]
    baseline_monthly_savings = max(ref_income - ref_expenses, 0)

    # 3. Determine optimized monthly savings
    total_cuts = sum(item.get("monthly_amount", 0) for item in payload.expense_cuts)
    optimized_monthly_savings = baseline_monthly_savings + payload.monthly_savings_extra + total_cuts
    monthly_gain = optimized_monthly_savings - baseline_monthly_savings

    # 4. Run projections
    r = payload.expected_return / 100 / 12  # monthly rate
    projections = []

    for year in range(1, payload.years + 1):
        months = year * 12
        # Future Value formula: FV = PV*(1+r)^n + PMT*[((1+r)^n - 1)/r]
        if r > 0:
            pv_factor = (1 + r) ** months
            fv_annuity_factor = (pv_factor - 1) / r
            
            base_fv = net_worth * pv_factor + baseline_monthly_savings * fv_annuity_factor
            opt_fv = net_worth * pv_factor + optimized_monthly_savings * fv_annuity_factor
        else: # No return, simple linear growth
            base_fv = net_worth + baseline_monthly_savings * months
            opt_fv = net_worth + optimized_monthly_savings * months
            
        projections.append(schemas.SimulatorProjection(
            year=year, 
            baseline=round(base_fv, 2),
            optimized=round(opt_fv, 2), 
            difference=round(opt_fv - base_fv, 2),
        ))

    total_extra = projections[-1].difference if projections else 0
    summary = (
        f"En optimisant votre épargne de {monthly_gain:,.0f} $/mois pendant {payload.years} ans, "
        f"votre patrimoine pourrait augmenter de {total_extra:,.0f} $ de plus que le scénario de base "
        f"(rendement annuel de {payload.expected_return:.1f}%)."
    )
    return schemas.SimulatorResult(
        projections=projections, 
        total_saved_extra=round(total_extra, 2),
        monthly_gain=round(monthly_gain, 2), 
        summary=summary,
    )


@router.get("/challenges/weekly")
def get_weekly_challenge(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    engine = FinancialAIEngine(db, current.id)
    curr_start, curr_end = engine._get_current_month_boundaries()
    curr = engine._get_monthly_stats(curr_start, curr_end)
    last_start, last_end = engine._get_last_month_boundaries()
    last = engine._get_monthly_stats(last_start, last_end)
    challenges = []
    if curr["by_category"]:
        top_cat = max(curr["by_category"], key=lambda k: curr["by_category"][k])
        top_amt = curr["by_category"][top_cat]
        target = round(top_amt * 0.8, 2)
        challenges.append({
            "id": "reduce_top",
            "title": f"Réduis tes dépenses {top_cat}",
            "description": f"Tu as dépensé {top_amt:,.0f}$ en {top_cat} ce mois. Vise {target:,.0f}$ la semaine prochaine !",
            "target_amount": target, "category": top_cat, "type": "reduce",
            "reward": "🏅 Maître de la Discipline",
        })
    ref_income = curr["income"] if curr["income"] > 0 else last["income"]
    if ref_income > 0:
        target_savings = round(ref_income * 0.20 / 4, 2)
        challenges.append({
            "id": "save_weekly", "title": "Objectif épargne semaine",
            "description": f"Épargne {target_savings:,.0f}$ cette semaine pour atteindre un taux d'épargne de 20%.",
            "target_amount": target_savings, "category": None, "type": "save",
            "reward": "💰 Épargnant Assidu",
        })
    challenges.append({
        "id": "no_impulse", "title": "Semaine sans achat impulsif",
        "description": "Évite tout achat non planifié cette semaine. Chaque achat doit être nécessaire.",
        "target_amount": 0, "category": None, "type": "behavior",
        "reward": "🧘 Zen Financier",
    })
    if not challenges:
        return {"challenge": None}
    week_num = datetime.now().isocalendar()[1]
    selected = challenges[week_num % len(challenges)]
    return {"challenge": selected, "all_challenges": challenges}


@router.get("/reports/monthly/pdf")
def export_monthly_pdf(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    import calendar as cal_mod
    today = dt_date.today()
    target_year = year or today.year
    target_month = month or today.month
    month_start = f"{target_year}-{target_month:02d}-01"
    last_day = cal_mod.monthrange(target_year, target_month)[1]
    month_end = f"{target_year}-{target_month:02d}-{last_day:02d}"
    month_names = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
    month_name = month_names[target_month - 1]
    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id, models.Transaction.date >= month_start, models.Transaction.date <= month_end)
        .order_by(models.Transaction.date.desc())
        .all()
    )
    income = sum(float(t.amount) for t, c in txs if c.type == "income")
    expenses = sum(float(t.amount) for t, c in txs if c.type == "expense")
    net = income - expenses
    savings_rate = (net / income * 100) if income > 0 else 0
    by_category: dict = {}
    for t, c in txs:
        if c.type == "expense":
            by_category[c.name] = by_category.get(c.name, 0) + float(t.amount)
    html_rows = "".join(
        f'<tr><td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{t.date}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{t.note or c.name}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{c.name}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e;text-align:right;color:{"#22c55e" if c.type=="income" else "#ef4444"};font-weight:600">{"+" if c.type=="income" else "-"}{float(t.amount):,.2f}$</td></tr>'
        for t, c in txs[:50]
    )
    cat_rows = "".join(
        f'<tr><td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{cat}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e;text-align:right">{amt:,.2f}$</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e;text-align:right">{(amt/expenses*100) if expenses>0 else 0:.1f}%</td></tr>'
        for cat, amt in sorted(by_category.items(), key=lambda x: -x[1])[:10]
    )
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>NexLedger — Rapport {month_name} {target_year}</title>
<style>
body{{font-family:Arial,sans-serif;background:#0d0d1a;color:#e2e8f0;margin:0;padding:40px;}}
h1{{font-size:26px;color:#a78bfa;margin-bottom:4px;}}
.sub{{color:#64748b;font-size:13px;margin-bottom:28px;}}
.kpi-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;}}
.kpi{{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;text-align:center;}}
.kpi .label{{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;}}
.kpi .value{{font-size:22px;font-weight:700;margin-top:4px;}}
.green{{color:#22c55e;}}.red{{color:#ef4444;}}.purple{{color:#a78bfa;}}.blue{{color:#60a5fa;}}
table{{width:100%;border-collapse:collapse;background:#111827;border-radius:10px;overflow:hidden;margin-bottom:20px;}}
th{{background:#1f2937;padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;}}
th:last-child,td:last-child{{text-align:right;}}
td{{color:#d1d5db;font-size:13px;}}
h2{{font-size:15px;color:#a78bfa;margin:24px 0 10px;border-left:3px solid #7c3aed;padding-left:10px;}}
.footer{{text-align:center;color:#374151;font-size:11px;margin-top:40px;border-top:1px solid #1f2937;padding-top:20px;}}
@media print{{body{{background:white;color:black;}} .kpi{{border:1px solid #ccc;}} table{{border:1px solid #ccc;}}}}
</style></head><body>
<h1>📊 NexLedger — Rapport Mensuel</h1>
<div class="sub">{month_name} {target_year} &nbsp;·&nbsp; Généré le {today.strftime('%d/%m/%Y')} &nbsp;·&nbsp; {current.email}</div>
<div class="kpi-grid">
  <div class="kpi"><div class="label">Revenus</div><div class="value green">{income:,.0f}$</div></div>
  <div class="kpi"><div class="label">Dépenses</div><div class="value red">{expenses:,.0f}$</div></div>
  <div class="kpi"><div class="label">Net</div><div class="value purple">{net:+,.0f}$</div></div>
  <div class="kpi"><div class="label">Taux épargne</div><div class="value blue">{savings_rate:.1f}%</div></div>
</div>
<h2>Répartition par catégorie</h2>
<table><thead><tr><th>Catégorie</th><th>Montant</th><th>Part</th></tr></thead><tbody>{cat_rows}</tbody></table>
<h2>Transactions ({len(txs)})</h2>
<table><thead><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Montant</th></tr></thead><tbody>{html_rows}</tbody></table>
{"<p style='color:#6b7280;font-size:12px'>... et " + str(len(txs)-50) + " transactions supplémentaires.</p>" if len(txs)>50 else ""}
<div class="footer">NexLedger — Portfolio FinTech &nbsp;·&nbsp; Ce rapport est généré automatiquement &nbsp;·&nbsp; Pour imprimer en PDF : Ctrl+P</div>
</body></html>"""
    filename = f"nexledger-{month_name.lower()}-{target_year}.html"
    return StreamingResponse(iter([html]), media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f"inline; filename={filename}"})
