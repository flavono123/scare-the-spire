#!/usr/bin/env python3
"""Focused regression tests for DLL-derived monster move graphs."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("parse-monsters.py")
SPEC = importlib.util.spec_from_file_location("parse_monsters", SCRIPT_PATH)
assert SPEC and SPEC.loader
parse_monsters = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parse_monsters)


class ParseMonsterMoveGraphTests(unittest.TestCase):
    def test_sample_merge_only_replaces_selected_graphs(self) -> None:
        existing = [
            {"id": "SAMPLE", "name": "old", "move_graph": None},
            {"id": "UNTOUCHED", "name": "keep", "move_graph": {"initial": "OLD"}},
        ]
        generated = [
            {"id": "SAMPLE", "name": "new", "move_graph": {"initial": "NEW"}},
            {"id": "UNTOUCHED", "name": "changed", "move_graph": {"initial": "CHANGED"}},
        ]

        merged = parse_monsters.merge_move_graph_samples(existing, generated, {"SAMPLE"})

        self.assertEqual(merged, [
            {"id": "SAMPLE", "name": "old", "move_graph": {"initial": "NEW"}},
            existing[1],
        ])

    def test_keeps_terminal_entry_point_without_transitions(self) -> None:
        graph = parse_monsters.parse_move_graph("""
            MoveState moveState = new MoveState("EXPLODE_MOVE", ExplodeMove);
            return new MonsterMoveStateMachine(list, moveState);
        """)

        self.assertEqual(graph["initial"], "EXPLODE")
        self.assertEqual(graph["transitions"], [])
        self.assertEqual(graph["states"], [
            {"id": "EXPLODE", "kind": "move", "next": None},
        ])

    def test_keeps_fixed_loop_direction(self) -> None:
        graph = parse_monsters.parse_move_graph("""
            MoveState ebb = new MoveState("EBB_MOVE", EbbMove);
            MoveState lasers = new MoveState("EYE_LASERS_MOVE", EyeLasersMove);
            MoveState intensity = new MoveState("INCREASING_INTENSITY_MOVE", IncreasingIntensityMove);
            ebb.FollowUpState = lasers;
            lasers.FollowUpState = intensity;
            intensity.FollowUpState = ebb;
            return new MonsterMoveStateMachine(list, ebb);
        """)

        self.assertEqual(graph["initial"], "EBB")
        self.assertEqual(
            [(state["id"], state["next"]) for state in graph["states"]],
            [("EBB", "EYE_LASERS"), ("EYE_LASERS", "INCREASING_INTENSITY"), ("INCREASING_INTENSITY", "EBB")],
        )

    def test_preserves_random_repeat_rules_and_effective_chances(self) -> None:
        graph = parse_monsters.parse_move_graph("""
            MoveState burn = new MoveState("SOUL_BURN_MOVE", BurnMove);
            MoveState maelstrom = new MoveState("MAELSTROM_MOVE", MaelstromMove);
            MoveState drain = new MoveState("DRAIN_LIFE_MOVE", DrainMove);
            RandomBranchState random = (RandomBranchState)(drain.FollowUpState = (maelstrom.FollowUpState = (burn.FollowUpState = new RandomBranchState("RAND"))));
            random.AddBranch(burn, MoveRepeatType.CannotRepeat, 1f);
            random.AddBranch(maelstrom, MoveRepeatType.CannotRepeat, 1f);
            random.AddBranch(drain, MoveRepeatType.CannotRepeat, 1f);
            return new MonsterMoveStateMachine(list, burn);
        """)

        random_state = next(state for state in graph["states"] if state["id"] == "RAND")
        self.assertEqual([branch["repeat"] for branch in random_state["branches"]], ["cannot_repeat"] * 3)
        self.assertEqual([branch["baseChance"] for branch in random_state["branches"]], [33.3] * 3)
        burn_edges = [edge for edge in graph["transitions"] if edge["from"] == "SOUL_BURN"]
        self.assertEqual([(edge["to"], edge["chance"]) for edge in burn_edges], [
            ("MAELSTROM", 50.0),
            ("DRAIN_LIFE", 50.0),
        ])

    def test_preserves_nested_conditional_and_random_states(self) -> None:
        graph = parse_monsters.parse_move_graph("""
            MoveState fabricate = new MoveState("FABRICATE_MOVE", FabricateMove);
            MoveState strike = new MoveState("FABRICATING_STRIKE_MOVE", StrikeMove);
            MoveState disintegrate = new MoveState("DISINTEGRATE_MOVE", DisintegrateMove);
            RandomBranchState random = new RandomBranchState("RAND");
            random.AddBranch(fabricate, MoveRepeatType.CanRepeatForever, () => 1f);
            random.AddBranch(strike, MoveRepeatType.CanRepeatForever, () => 1f);
            ConditionalBranchState branch = new ConditionalBranchState("fabricateBranch");
            branch.AddState(random, () => CanFabricate);
            branch.AddState(disintegrate, () => !CanFabricate);
            fabricate.FollowUpState = branch;
            strike.FollowUpState = branch;
            disintegrate.FollowUpState = branch;
            return new MonsterMoveStateMachine(list, branch);
        """)

        self.assertEqual(graph["initial"], "fabricateBranch")
        self.assertEqual(graph["confidence"], "static")
        conditional = next(state for state in graph["states"] if state["id"] == "fabricateBranch")
        self.assertEqual(conditional["branches"], [
            {"to": "RAND", "condition": "CanFabricate"},
            {"to": "DISINTEGRATE", "condition": "!CanFabricate"},
        ])
        random_state = next(state for state in graph["states"] if state["id"] == "RAND")
        self.assertEqual([branch["to"] for branch in random_state["branches"]], ["FABRICATE", "FABRICATING_STRIKE"])
        for source in ("FABRICATE", "FABRICATING_STRIKE", "DISINTEGRATE", "__START__"):
            source_edges = [edge for edge in graph["transitions"] if edge["from"] == source]
            self.assertEqual(source_edges, [
                {
                    "from": source,
                    "to": "FABRICATE",
                    "chance": 50.0,
                    "kind": "conditional",
                    "condition": "CanFabricate",
                },
                {
                    "from": source,
                    "to": "FABRICATING_STRIKE",
                    "chance": 50.0,
                    "kind": "conditional",
                    "condition": "CanFabricate",
                },
                {
                    "from": source,
                    "to": "DISINTEGRATE",
                    "chance": None,
                    "kind": "conditional",
                    "condition": "!CanFabricate",
                },
            ])


if __name__ == "__main__":
    unittest.main()
