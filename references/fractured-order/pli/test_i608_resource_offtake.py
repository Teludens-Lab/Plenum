"""I6.08 resource-backed offtake and I6.09 partner capacity finance helpers."""
from __future__ import annotations

from adjudicate import MASTER_CODEBOOK, SYSTEM_BRIEF, _cross_check
from run_pli import RESCORE_REASON_MARKERS, _should_skip_existing_adjudication
from tracks.router import build_routing_record


def _base_worksheet(*, lever: str, instrument: str | None, secondary: str | None = None) -> dict:
    return {
        "classification": {
            "lever": lever,
            "instrument": instrument,
            "secondary_instrument": secondary,
            "direction": "inducement",
            "rule_citation": (
                "Tie-break rule 7 (rule 7 scope): resource-backed lending + offtake -> L6; "
                "I6.08 loans-for-minerals with premium-price purchase pledge"
            ),
        },
        "precedent": {
            "tier": 1,
            "citations": [
                "CHEXIM / CDB resource-backed loans (Angola model)",
                "PRC long-term offtake contracts with Latin American mineral producers",
            ],
            "rationale": "Standing PRC policy-bank and SOE offtake authorities already exist",
        },
        "modifiers": {},
        "needs_human": False,
        "instrument_of_power": "Economic",
        "ne_facets": {"diplomacy": False, "information": False},
        "submission_month": "2027-01",
    }


def test_cross_check_accepts_l6_i608_with_i604_secondary():
    _cross_check(_base_worksheet(lever="L6", instrument="I6.08", secondary="I6.04"))


def test_ui_lever_resource_backed_finance_maps_to_l6():
    action = {
        "mechanism": "Economic",
        "ally_contingencies": 'Levers: ["Resource-Backed Finance & Offtake"]',
    }
    rec = build_routing_record(action)
    assert rec["ui_levers"] == ["Resource-Backed Finance & Offtake"]
    assert rec["ui_lever_priors"] == ["L6"]


def test_master_codebook_and_prompt_carry_i608():
    assert "| I6.08 |" in MASTER_CODEBOOK
    assert "Rule 7 scope" in MASTER_CODEBOOK
    assert "L6 / I6.08" in SYSTEM_BRIEF
    assert "Resource-Backed Finance & Offtake" in SYSTEM_BRIEF


def test_cross_check_accepts_l6_i609_partner_capacity_finance():
    ws = _base_worksheet(lever="L6", instrument="I6.09")
    ws["classification"]["direction"] = "mixed"
    ws["classification"]["rule_citation"] = (
        "Tie-break rule 7 (rule 7 scope): partner supply-chain capacity finance -> L6/I6.09; "
        "not L7 (plant abroad), not L8 (no stockpile)"
    )
    _cross_check(ws)


def test_ui_lever_partner_capacity_finance_maps_to_l6():
    action = {
        "mechanism": "Economic",
        "ally_contingencies": 'Levers: ["Partner Supply-Chain Capacity Finance"]',
    }
    rec = build_routing_record(action)
    assert rec["ui_lever_priors"] == ["L6"]


def test_master_codebook_and_prompt_carry_i609():
    assert "| I6.09 |" in MASTER_CODEBOOK
    assert "Morocco phosphate" in MASTER_CODEBOOK
    assert "L6 / I6.09" in SYSTEM_BRIEF
    assert "Partner Supply-Chain Capacity Finance" in SYSTEM_BRIEF


def test_rescore_marker_picks_up_partner_capacity_needs_human():
    assert "partner capacity finance" in RESCORE_REASON_MARKERS
    row = {
        "status": "needs_human",
        "record": {
            "tracks": {
                "macro": {
                    "needs_human_reason": (
                        "Finance for phosphate extraction and refinement in Morocco sits "
                        "between I6.01 aid and L7 capacity; partner capacity finance has no code."
                    )
                }
            }
        },
    }
    assert _should_skip_existing_adjudication(row) is False


def test_rescore_marker_picks_up_offtake_needs_human():
    for marker in ("offtake", "above market", "resource-backed", "BRICS+ accession"):
        assert marker in RESCORE_REASON_MARKERS
    row = {
        "status": "needs_human",
        "record": {
            "tracks": {
                "macro": {
                    "needs_human_reason": (
                        "Bundled Economic filing: PRC infrastructure loans plus a pledge that "
                        "50% of extracts are sold to BRICS+ at 2% above market value; no "
                        "L1-L10 instrument covers the offtake component."
                    )
                }
            }
        },
    }
    assert _should_skip_existing_adjudication(row) is False
