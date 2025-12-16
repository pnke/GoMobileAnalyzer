from core.analysis.katago_utils import construct_katago_query, process_analysis_results
from core.sgf.parser import SGF

# Sample SGF for testing
SAMPLE_SGF = (
    "(;GM[1]SZ[19]KM[6.5]RU[Japanese]PB[Black]PW[White];B[pd];W[dp];B[pq];W[dd])"
)


def test_construct_katago_query_defaults():
    req_id = "test-id"
    query, num_expected, sgf_root, main_line_nodes = construct_katago_query(
        req_id, SAMPLE_SGF, visits=100
    )

    assert query["id"] == req_id
    assert query["maxVisits"] == 100
    assert query["rules"] == "Japanese"
    assert query["komi"] == 6.5
    assert query["boardXSize"] == 19
    assert query["boardYSize"] == 19
    # 4 moves + 1 root = 5 nodes, but moves list in query excludes root
    # moves in query: B pd, W dp, B pq, W dd.
    assert len(query["moves"]) == 4
    assert query["moves"][0] == ["B", "Q16"]  # pd -> Q16

    # Defaults: start_turn=None (0), end_turn=None (total)
    # 0 (root), 1, 2, 3, 4 (last move)
    # analyzeTurns should be 0..4
    assert query["analyzeTurns"] == [0, 1, 2, 3, 4]
    assert num_expected == 5
    assert len(main_line_nodes) == 5


def test_construct_katago_query_partial_range():
    req_id = "test-id"
    # Analyze only turn 2 and 3
    query, num_expected, _, _ = construct_katago_query(
        req_id, SAMPLE_SGF, visits=100, start_turn=2, end_turn=3
    )
    assert query["analyzeTurns"] == [2, 3]
    assert num_expected == 2


def test_construct_katago_query_out_of_bounds():
    req_id = "test-id"
    # Range beyond moves
    query, num_expected, _, _ = construct_katago_query(
        req_id, SAMPLE_SGF, visits=100, start_turn=10, end_turn=20
    )
    # Should clamp to max turns (4)
    # Start=10 -> clamped to 4. End=20 -> clamped to 4.
    # Range [4, 4] -> [4]
    assert query["analyzeTurns"] == [4]
    assert num_expected == 1


def test_construct_katago_query_initial_stones():
    # SGF with initial stones
    sgf_handicap = "(;GM[1]SZ[19]AB[dd][pp]AW[dp][pd])"
    query, _, _, _ = construct_katago_query("h", sgf_handicap, 10)

    initial_stones = query["initialStones"]
    # Check if stones are present. Order might vary so check existence.
    gtp_stones = {(p, c) for p, c in initial_stones}
    assert ("B", "D16") in gtp_stones
    assert ("W", "D4") in gtp_stones
    assert len(initial_stones) == 4


def test_process_analysis_results():
    sgf_root = SGF.parse_sgf(SAMPLE_SGF)
    main_line_nodes = sgf_root.nodes_in_tree

    # Mock analysis results for move 1 (Black first move)
    analysis_data = [
        {
            "id": "test",
            "turnNumber": 1,
            "rootInfo": {"winrate": 0.45, "scoreLead": -1.5, "currentPlayer": "W"},
            "moveInfos": [
                {
                    "move": "D4",
                    "winrate": 0.46,
                    "scoreLead": -1.0,
                    "order": 0,
                    "pv": ["D4", "Q16"],
                },
                {"move": "C4", "winrate": 0.44, "scoreLead": -2.0, "order": 1},
            ],
        }
    ]

    process_analysis_results(main_line_nodes, analysis_data)

    node_1 = main_line_nodes[1]  # The node for move 1
    comment = node_1.get_property("C")

    assert "Winrate: 45.0%" in comment
    assert "Score: -1.5" in comment

    # Check variations were added
    # Node 1 children: Original move (W dp is next in main line, so node 2 is child of node 1)
    # Wait, process_analysis_results adds variations to the node where analysis happened.
    # Analysis for turn 1 matches node 1 (B pd).
    # Variations should be alternatives to the NEXT move (W dp).

    # Children of node 1:
    # 1. The original next move (W dp)
    # 2. Variation D4 (if different from played) - Wait, D4 IS dp.
    # If top move is same as played move, it might not add variation or adds comment?
    # Logic: if var_move_gtp != played_move_gtp: add variation

    # In sample: Move 1 is B pd. Next is W dp (D4).
    # Top mock move is D4. So D4 == D4. No variation for top move.

    # Second mock move is C4. C4 != D4. Should add variation.
    children = node_1.children
    # Original child + C4 variation = 2 children
    assert len(children) >= 2

    # Find C4 variation
    c4_child = None
    for child in children:
        if child.move and child.move.gtp() == "C4":
            c4_child = child
            break

    assert c4_child is not None
    assert "Var - Win: 44.0%" in c4_child.get_property("C")
