from fastapi import APIRouter, Depends

import schemas
import models
from auth import get_current_user

router = APIRouter()

_PROVINCIAL_RATES = {
    "QC": [(0, 15, 0.15+0.14), (15, 50, 0.205+0.19), (50, 100, 0.26+0.24), (100, 165, 0.29+0.2575), (165, 1e9, 0.33+0.2575)],
    "ON": [(0, 15, 0.15+0.0505), (15, 50, 0.205+0.0915), (50, 100, 0.26+0.1116), (100, 220, 0.29+0.1216), (220, 1e9, 0.33+0.1316)],
    "BC": [(0, 15, 0.15+0.0506), (15, 45, 0.205+0.077), (45, 91, 0.26+0.105), (91, 113, 0.29+0.1229), (113, 1e9, 0.33+0.205)],
    "AB": [(0, 15, 0.15+0.10), (15, 49, 0.205+0.10), (49, 100, 0.26+0.10), (100, 150, 0.29+0.12), (150, 1e9, 0.33+0.15)],
    "other": [(0, 15, 0.15+0.06), (15, 50, 0.205+0.085), (50, 100, 0.26+0.10), (100, 220, 0.29+0.12), (220, 1e9, 0.33+0.15)],
}


def _marginal_rate(income_k: float, province: str) -> float:
    brackets = _PROVINCIAL_RATES.get(province, _PROVINCIAL_RATES["other"])
    for lo, hi, rate in brackets:
        if lo <= income_k < hi:
            return rate
    return 0.53


def _compound(principal: float, annual_rate: float, years: int) -> float:
    return principal * ((1 + annual_rate) ** years)


@router.post("/canada/rrsp-tfsa", response_model=schemas.CanadaOptimizerResult)
def canada_optimizer(
    payload: schemas.CanadaOptimizerRequest,
    current: models.User = Depends(get_current_user),
):
    income_k = payload.annual_income / 1000
    province = payload.province if payload.province in _PROVINCIAL_RATES else "other"
    marginal = _marginal_rate(income_k, province)
    rrsp_room = payload.rrsp_room if payload.rrsp_room is not None else min(payload.annual_income * 0.18, 31560)
    years_eligible = max(0, min(payload.age - 18, 16))
    tfsa_room = 7000 + years_eligible * 6500
    available = payload.available_savings
    if marginal >= 0.30:
        rec_rrsp = min(available, rrsp_room)
        rec_tfsa = min(available - rec_rrsp, tfsa_room)
    else:
        rec_tfsa = min(available, tfsa_room)
        rec_rrsp = min(available - rec_tfsa, rrsp_room)
    tax_refund = rec_rrsp * marginal

    def make_scenario(name: str, rrsp: float, tfsa: float) -> schemas.CanadaScenario:
        refund = rrsp * marginal
        rrsp_10 = _compound(rrsp, 0.06, 10) * 0.75
        rrsp_20 = _compound(rrsp, 0.06, 20) * 0.75
        rrsp_30 = _compound(rrsp, 0.06, 30) * 0.75
        tfsa_10 = _compound(tfsa, 0.05, 10)
        tfsa_20 = _compound(tfsa, 0.05, 20)
        tfsa_30 = _compound(tfsa, 0.05, 30)
        return schemas.CanadaScenario(
            name=name, rrsp_contribution=rrsp, tfsa_contribution=tfsa,
            tax_refund=refund, net_cost=rrsp + tfsa - refund,
            projected_10y=rrsp_10 + tfsa_10, projected_20y=rrsp_20 + tfsa_20,
            projected_30y=rrsp_30 + tfsa_30,
        )

    scenarios = [
        make_scenario("Optimisé (recommandé)", rec_rrsp, rec_tfsa),
        make_scenario("Tout en REER", min(available, rrsp_room), 0),
        make_scenario("Tout en CELI", 0, min(available, tfsa_room)),
        make_scenario("50% / 50%", min(available * 0.5, rrsp_room), min(available * 0.5, tfsa_room)),
    ]
    tips: list[str] = []
    if marginal >= 0.40:
        tips.append("Votre taux marginal est élevé (≥40%) — priorisez le REER pour réduire votre impôt immédiatement.")
    elif marginal < 0.25:
        tips.append("Votre taux marginal est bas — le CELI est souvent plus avantageux car les retraits sont non imposables.")
    if payload.age < 35:
        tips.append("À votre âge, le CELI est très puissant grâce à la croissance composée sur plusieurs décennies.")
    if payload.age >= 50:
        tips.append("À 71 ans, le REER doit être converti en FERR. Planifiez vos retraits dès maintenant.")
    if rec_rrsp > 0:
        tips.append(f"Votre remboursement d'impôt estimé pour ce REER : ${tax_refund:,.0f} — réinvestissez-le dans votre CELI!")
    if payload.province == "QC":
        tips.append("Au Québec, vous bénéficiez aussi d'une déduction provinciale sur le REER — double avantage fiscal.")
    return schemas.CanadaOptimizerResult(
        marginal_rate=round(marginal * 100, 1), rrsp_room=rrsp_room, tfsa_room=tfsa_room,
        recommended_rrsp=rec_rrsp, recommended_tfsa=rec_tfsa, tax_refund=tax_refund,
        scenarios=scenarios, tips=tips,
    )
