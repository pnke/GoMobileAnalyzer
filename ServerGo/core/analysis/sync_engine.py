import subprocess
import json
import os
import threading
import uuid
import time
import logging
from typing import Optional, Dict
from queue import Queue, Empty

# Use absolute import for shared package structure
from core.sgf.parser import SGF, Move

logger = logging.getLogger(__name__)


class KataGoEngine:
    """
    A class that manages a single KataGo process using the GTP (Go Text Protocol) analysis engine.
    Synchronous implementation using threading and subprocess.
    """

    def __init__(self, katago_path, config_path, model_path):
        self.katago_path = katago_path
        self.config_path = config_path
        self.model_path = model_path
        self.katago_process: Optional[subprocess.Popen] = None
        self.lock = threading.Lock()
        self.response_queue: Queue[str] = Queue()
        self.stderr_queue: Queue[str] = Queue()
        self.pending_requests: Dict[str, Dict] = {}

    def start(self):
        if not os.path.exists(self.config_path):
            logger.warning(
                f"Note: Config file '{self.config_path}' not found. Creating default config."
            )
            try:
                with open(self.config_path, "w") as f:
                    f.write("logFile = /dev/stdout\n")
                    f.write("analysisThreads = 8\n")
            except IOError as e:
                logger.warning(f"Warning: Could not create config file: {e}")

        command = [
            self.katago_path,
            "analysis",
            "-config",
            self.config_path,
            "-model",
            self.model_path,
        ]

        logger.info(f"Starting KataGo process: {' '.join(command)}")
        try:
            self.katago_process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                bufsize=1,
            )
        except FileNotFoundError:
            logger.error(
                f"ERROR: KataGo executable not found at '{self.katago_path}'. Please check path."
            )
            raise

        # Start threads to read pipes
        threading.Thread(
            target=self._read_pipe,
            args=(self.katago_process.stdout, self.response_queue),
            daemon=True,
        ).start()
        threading.Thread(
            target=self._read_pipe,
            args=(self.katago_process.stderr, self.stderr_queue),
            daemon=True,
        ).start()
        threading.Thread(target=self._dispatch_responses, daemon=True).start()

        # Robust start: Wait for "Ready" message
        logger.info("Waiting for KataGo initialization...")
        start_time = time.time()
        is_ready = False

        # Wait up to 120 seconds (GPU init can take time)
        while time.time() - start_time < 120:
            if not self.is_running():
                logger.error(
                    "FATAL: KataGo process exited unexpectedly during initialization."
                )
                self._print_stderr()
                raise RuntimeError("KataGo process exited during initialization")

            try:
                line = self.stderr_queue.get(timeout=0.5)
                logger.info(f"[KataGo stderr]: {line.strip()}")
                if "Started, ready to begin handling requests" in line:
                    logger.info("KataGo 'Ready' message received.")
                    is_ready = True
                    break
            except Empty:
                continue

        if not is_ready:
            logger.error("FATAL: Timeout waiting for KataGo 'Ready' message.")
            self._print_stderr()
            raise RuntimeError("Timeout waiting for KataGo to start")

        logger.info("KataGo process successfully started and ready.")

    def _read_pipe(self, pipe, queue):
        """
        Reads lines from a pipe and puts them into a queue.
        Runs in a separate thread.
        """
        try:
            for line in iter(pipe.readline, ""):
                queue.put(line)
        except ValueError:
            pass  # Pipe might be closed
        finally:
            pipe.close()

    def _dispatch_responses(self):
        """
        Reads JSON responses from the response queue and dispatches them to the appropriate pending request.
        Runs in a separate thread.
        """
        while True:
            try:
                line = self.response_queue.get(timeout=0.1)
                if not line:
                    continue
                # logging raw stdout if needed
                # logger.debug(f"raw_stdout: {line.strip()}")

                response = json.loads(line)
                req_id = response.get("id")

                if "error" in response:
                    logger.error(f"KataGo Backend Error: {response.get('error')}")
                    # Optionally put error in result list to propagate it to caller?
                    # For now, just logging it is enough to debug.

                if req_id and "error" not in response:
                    with self.lock:
                        if req_id in self.pending_requests:
                            self.pending_requests[req_id]["results"].append(response)

            except Empty:
                if self.katago_process and not self.is_running():
                    pass
                if not self.is_running():
                    break
            except (json.JSONDecodeError, AttributeError):
                if line:
                    logger.warning(f"[KataGo non-JSON]: {line.strip()}")
            except Exception as e:
                logger.error(f"Dispatch Error: {e}")

    def _print_stderr(self):
        """Helper to print all remaining lines in stderr queue."""
        logger.error("--- KataGo Stderr ---")
        while not self.stderr_queue.empty():
            logger.error(self.stderr_queue.get().strip())
        logger.error("---------------------")

    def is_running(self):
        """Check if the KataGo process is still running."""
        return self.katago_process is not None and self.katago_process.poll() is None

    def analyze_streaming_generator(
        self,
        sgf_content: str,
        visits: int,
        start_turn: Optional[int] = None,
        end_turn: Optional[int] = None,
    ):
        """
        Generator that yields analysis results per turn as they arrive from KataGo.
        This is a synchronous generator. (Renamed to avoid conflict with async caller wrapper naming preferenece)
        """
        if not self.is_running():
            self._print_stderr()
            raise RuntimeError("KataGo process is not running.")

        req_id = str(uuid.uuid4())
        sgf_root = SGF.parse_sgf(sgf_content)

        main_line_nodes = sgf_root.nodes_in_tree
        moves = [[m.move.player, m.move.gtp()] for m in main_line_nodes[1:] if m.move]

        # Handle initial stones (AB/AW)
        initial_stones = []
        for placement in sgf_root.placements:
            initial_stones.append([placement.player, placement.gtp()])

        initial_player = sgf_root.initial_player
        total_turns = len(moves)

        # Default yield offset (Back-looking analysis: Result N -> Frontend Turn N+1)
        yield_offset = 1

        # Check for first move collision with setup stones (common in SGFs with setup)
        if moves and initial_stones:
            first_move_gtp = moves[0][1]
            # Check if this coordinate matches any setup stone
            if any(s[1] == first_move_gtp for s in initial_stones):
                logger.info(
                    f"Skipping first move {first_move_gtp} as it duplicates a Setup Stone."
                )
                # Treat the first move as already played via setup.
                # Remove it from moves list.
                moves = moves[1:]
                total_turns = len(moves)
                # Flip initial player: If SGF said Black to play, and we just "played" Black's move via setup,
                # it is now White's turn.
                initial_player = Move.opponent_player(initial_player)

                # Shift yield offset because we removed one move from the backend list.
                # Backend Result 0 now corresponds to Original Move 2 (Frontend Index 2).
                # 0 + offset = 2 -> offset = 2.
                yield_offset = 2

        # Logic from user code
        if total_turns == 0 and len(initial_stones) > 0:
            analyze_turns = [0]
            num_expected = 1
        else:
            s = start_turn if start_turn is not None else 1
            e = end_turn if end_turn is not None else total_turns
            s = max(1, min(s, total_turns))
            e = max(s, min(e, total_turns))

            # For each move N, analyze position N-1
            analyze_turns = list(range(s - 1, e))
            num_expected = len(analyze_turns)

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
            "includeOwnership": False,
            "includePolicy": False,
        }

        with self.lock:
            self.pending_requests[req_id] = {
                "num_expected": num_expected,
                "results": [],
            }

        if self.katago_process and self.katago_process.stdin:
            self.katago_process.stdin.write(json.dumps(query) + "\n")
            self.katago_process.stdin.flush()
        else:
            raise RuntimeError("KataGo stdin not available")

        # Yield results as they arrive
        received_count = 0
        timeout_per_turn = 30
        last_receive_time = time.time()

        while received_count < num_expected:
            with self.lock:
                results = self.pending_requests.get(req_id, {}).get("results", [])
                # Get only new results
                new_results = []
                if len(results) > received_count:
                    new_results = results[received_count:]

            if new_results:
                last_receive_time = time.time()
                for result in new_results:
                    received_count += 1

                    root_info = result.get("rootInfo", {})
                    move_infos = result.get("moveInfos", [])

                    yield {
                        "turn": result.get("turnNumber", 0)
                        + yield_offset,  # Dynamic Offset (+1 or +2)
                        "total": num_expected,
                        "winrate": round(root_info.get("winrate", 0) * 100, 1),
                        "score": round(root_info.get("scoreLead", 0), 1),
                        "currentPlayer": root_info.get("currentPlayer", "B"),
                        "topMoves": [
                            {
                                "move": m.get("move"),
                                "winrate": round(m.get("winrate", 0) * 100, 1),
                                "scoreLead": round(m.get("scoreLead", 0), 1),
                                "visits": m.get("visits", 0),
                                "pv": m.get("pv", []),
                            }
                            for m in move_infos
                        ],
                    }
            else:
                if time.time() - last_receive_time > timeout_per_turn:
                    with self.lock:
                        self.pending_requests.pop(req_id, None)
                    raise RuntimeError(
                        f"Streaming timeout after {received_count} of {num_expected} turns"
                    )
                time.sleep(0.05)

        with self.lock:
            self.pending_requests.pop(req_id, None)

    def close(self):
        if self.is_running() and self.katago_process:
            try:
                self.katago_process.terminate()
            except OSError:
                pass
