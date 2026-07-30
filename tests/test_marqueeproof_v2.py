"""Executable MarqueeProof ticket, permission and settlement tests."""

import json
from pathlib import Path


CONTRACT = str(Path(__file__).resolve().parents[1] / "contracts" / "marqueeproof.py")


def _show(contract):
    return contract.open_show(
        "Public Night", "Civic Hall", "2026-10-14", "Official ticketed event", "https://example.com"
    )


def test_house_policy_ticket_ownership_and_replay(deploy, direct_vm, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    contract = deploy(CONTRACT)
    show_id = _show(contract)
    contract.add_venue_proof(
        str(show_id), "Venue calendar", "https://example.org", "Published listing"
    )
    batch_id = contract.mint_ticket_batch(
        str(show_id), "Stalls", 200, 4500, "https://example.net"
    )
    contract.check_in_ticket(str(show_id), batch_id, "ticket-0001", "Gate A")

    with direct_vm.expect_revert("ticket_already_checked_in"):
        contract.check_in_ticket(str(show_id), batch_id, "ticket-0001", "Gate B")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("admin_only"):
        contract.set_house_policy("untrusted policy")
    with direct_vm.expect_revert("show_operator_only"):
        contract.mint_ticket_batch(str(show_id), "Fake", 10, 1, "https://example.edu")


def test_challenge_and_appeal_revise_show_verdict_before_settlement(
    deploy, direct_vm, direct_alice, direct_bob
):
    direct_vm.sender = direct_alice
    contract = deploy(CONTRACT)
    show_id = _show(contract)
    contract.add_venue_proof(
        str(show_id), "Venue calendar", "https://example.org", "Published listing"
    )
    contract.mint_ticket_batch(str(show_id), "Stalls", 200, 4500, "https://example.net")

    direct_vm.mock_llm(
        r"contract that verifies public event pages",
        json.dumps({
            "verdict": "authentic",
            "confidenceBps": 8500,
            "venueMatchBps": 9000,
            "ticketRiskBps": 900,
            "summary": "The venue and sale records align.",
            "rationale": "Official and venue sources corroborate the event.",
            "riskFlags": [],
        }),
    )
    contract.audit_show_with_genlayer(str(show_id))
    contract.open_challenge_window(str(show_id))

    direct_vm.sender = direct_bob
    challenge_id = contract.file_challenge(
        str(show_id), "The venue cancelled the booking.", "https://example.edu"
    )

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("open_filing"):
        contract.settle_show(str(show_id))

    direct_vm.mock_llm(
        r"resolving a challenge filing",
        json.dumps({
            "ruling": "upheld",
            "revisedVerdict": "rejected",
            "confidenceDeltaBps": -1900,
            "reason": "The cancellation notice controls.",
            "riskFlags": ["VENUE_CANCELLED"],
        }),
    )
    contract.resolve_challenge_with_genlayer(str(show_id), challenge_id)
    assert contract.get_show(show_id)["verdict"] == "rejected"

    direct_vm.sender = direct_bob
    appeal_id = contract.file_appeal(
        str(show_id), "The venue reinstated the booking.", "https://example.gov"
    )

    direct_vm.sender = direct_alice
    direct_vm.mock_llm(
        r"resolving a appeal filing",
        json.dumps({
            "ruling": "retuned",
            "revisedVerdict": "authentic",
            "confidenceDeltaBps": 1700,
            "reason": "The reinstatement notice restores the event.",
            "riskFlags": [],
        }),
    )
    contract.resolve_appeal_with_genlayer(str(show_id), appeal_id)
    contract.settle_show(str(show_id))

    record = json.loads(contract.get_show_record(str(show_id)))
    assert record["status"] == "SETTLED"
    assert record["verdict"] == "authentic"

