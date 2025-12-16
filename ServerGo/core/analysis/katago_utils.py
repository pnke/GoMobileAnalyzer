from typing import Tuple, Dict, Any, List, Optional
from core.sgf.parser import SGF, Move, SGFNode


def construct_katago_query(
    req_id: str,
    sgf_content: str,
    visits: int,
    start_turn: Optional[int] = None,
    end_turn: Optional[int] = None,
    include_ownership: bool = True,
) -> Tuple[Dict[str, Any], int, SGFNode, List[Any]]:
    """
    Parses SGF and constructs the KataGo analysis query.

    Returns:
        tuple: (query_dict, num_expected_results, sgf_root, main_line_nodes)
    """
    sgf_root = SGF.parse_sgf(sgf_content)
    main_line_nodes = sgf_root.nodes_in_tree
    moves = [[m.move.player, m.move.gtp()] for m in main_line_nodes[1:] if m.move]

    initial_stones = []
    for placement in sgf_root.placements:
        initial_stones.append([placement.player, placement.gtp()])

    initial_player = sgf_root.initial_player
    total_turns = len(moves)

    if total_turns == 0 and len(initial_stones) > 0:
        analyze_turns = [0]
    else:
        s = start_turn if start_turn is not None else 0
        e = end_turn if end_turn is not None else total_turns
        s = max(0, min(s, total_turns))
        e = max(s, min(e, total_turns))
        analyze_turns = list(range(s, e + 1))

    query = {
        "id": req_id,
        "moves": moves,
        "initialStones": initial_stones,
        "initialPlayer": initial_player,
        "rules": sgf_root.ruleset or "japanese",
        "komi": sgf_root.komi or 6.5,
        "boardXSize": sgf_root.board_size[0],
        "boardYSize": sgf_root.board_size[1],
        "analyzeTurns": analyze_turns,
        "maxVisits": visits,
        "includeOwnership": include_ownership,
        "includePolicy": include_ownership,
    }

    return query, len(analyze_turns), sgf_root, main_line_nodes


def process_analysis_results(main_line_nodes: list, analysis_jsonl: list) -> None:
    """
    Annotate the SGF nodes with analysis results.
    Modifies main_line_nodes in-place.
    """
    analysis_map = {item["turnNumber"]: item for item in analysis_jsonl}
    for i, current_node in enumerate(main_line_nodes):
        analysis = analysis_map.get(i)
        if not analysis:
            continue

        root_info = analysis.get("rootInfo", {})
        winrate = root_info.get("winrate", 0) * 100
        score = root_info.get("scoreLead", 0)

        comment = f"Winrate: {winrate:.1f}%, Score: {score:.1f}"
        existing_comment = current_node.get_property("C")
        current_node.set_property(
            "C", (existing_comment + "\\n" + comment) if existing_comment else comment
        )

        move_infos = sorted(
            analysis.get("moveInfos", []), key=lambda m: m.get("order", 99)
        )
        played_move_gtp = None
        if i + 1 < len(main_line_nodes):
            played_move_node = main_line_nodes[i + 1]
            if played_move_node.move:
                played_move_gtp = played_move_node.move.gtp()

        player_to_move = root_info.get("currentPlayer")
        variation_count = 0

        for var_info in move_infos:
            var_move_gtp = var_info.get("move")
            if var_move_gtp != played_move_gtp:
                var_node = current_node.play(
                    Move.from_gtp(var_move_gtp, player=player_to_move)
                )
                var_winrate = var_info.get("winrate", 0) * 100
                var_score = var_info.get("scoreLead", 0)
                var_node.set_property(
                    "C", f"Var - Win: {var_winrate:.1f}%, Score: {var_score:.1f}"
                )

                pv_parent_node = var_node
                pv_player = (
                    Move.opponent_player(player_to_move) if player_to_move else None
                )

                for pv_move_gtp in var_info.get("pv", [])[1:]:
                    if not pv_player:
                        break
                    pv_child_node = pv_parent_node.play(
                        Move.from_gtp(pv_move_gtp, player=pv_player)
                    )
                    pv_parent_node = pv_child_node
                    pv_player = Move.opponent_player(pv_player)

                variation_count += 1
                if variation_count >= 3:
                    break
