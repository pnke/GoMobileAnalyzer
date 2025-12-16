"""
SGF Parser for Go game records.

This parser is heavily inspired by and adapted from the KaTrain project's
SGF parsing implementation:
https://github.com/sanderland/katrain

The original KaTrain code is licensed under the MIT License.
Modifications have been made to integrate with this project's architecture.
"""

import copy
import chardet
import math
import re
from collections import defaultdict
from typing import Any, DefaultDict, Dict, List, Optional, Tuple, Union, cast


class ParseError(Exception):
    """Exception raised on a parse error."""

    pass


class Move:
    GTP_COORD = list("ABCDEFGHJKLMNOPQRSTUVWXYZ") + [
        xa + c for xa in "ABCDEFGH" for c in "ABCDEFGHJKLMNOPQRSTUVWXYZ"
    ]  # Support for board sizes > 25 (up to 52+)
    PLAYERS = "BW"
    SGF_COORD = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ".lower()) + list(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    )  # SGF supports up to 52x52

    @classmethod
    def from_gtp(cls, gtp_coords, player="B"):
        """Initialize a move from GTP coordinates and player."""
        if "pass" in gtp_coords.lower():
            return cls(coords=None, player=player)
        match = re.match(r"([A-Z]+)(\d+)", gtp_coords)
        if not match:
            raise ValueError(f"Invalid GTP coordinates: {gtp_coords}")
        return cls(
            coords=(Move.GTP_COORD.index(match.group(1)), int(match.group(2)) - 1),
            player=player,
        )

    @classmethod
    def from_sgf(cls, sgf_coords, board_size, player="B"):
        """Initialize a move from SGF coordinates and player."""
        if sgf_coords == "" or (
            sgf_coords == "tt" and board_size[0] <= 19 and board_size[1] <= 19
        ):  # [tt] is used as "pass" for board sizes <= 19x19
            return cls(coords=None, player=player)
        return cls(
            coords=(
                Move.SGF_COORD.index(sgf_coords[0]),
                board_size[1] - Move.SGF_COORD.index(sgf_coords[1]) - 1,
            ),
            player=player,
        )

    def __init__(self, coords: Optional[Tuple[int, int]] = None, player: str = "B"):
        """Initialize a move from zero-based coordinates and player."""
        self.player = player
        self.coords = coords

    def __repr__(self):
        return f"Move({self.player or ''}{self.gtp()})"

    def __eq__(self, other):
        return self.coords == other.coords and self.player == other.player

    def __hash__(self):
        return hash((self.coords, self.player))

    def gtp(self):
        """Returns GTP coordinates of the move."""
        if self.is_pass or self.coords is None:
            return "pass"
        return Move.GTP_COORD[self.coords[0]] + str(self.coords[1] + 1)

    def sgf(self, board_size):
        """Returns SGF coordinates of the move."""
        if self.is_pass or self.coords is None:
            return ""
        return f"{Move.SGF_COORD[self.coords[0]]}{Move.SGF_COORD[board_size[1] - self.coords[1] - 1]}"

    @property
    def is_pass(self):
        """Returns True if the move is a pass."""
        return self.coords is None

    @staticmethod
    def opponent_player(player):
        """Returns the opposing player (W <-> B)."""
        return "W" if player == "B" else "B"

    @property
    def opponent(self):
        """Returns the opposing player (W <-> B)."""
        return self.opponent_player(self.player)


class SGFNode:
    def __init__(
        self,
        parent: Optional["SGFNode"] = None,
        properties: Optional[Dict] = None,
        move: Optional[Move] = None,
    ):
        self.children: List["SGFNode"] = []
        self.properties: DefaultDict[str, List[Any]] = defaultdict(list)
        if properties:
            for k, v in properties.items():
                self.set_property(k, v)
        self.parent: Optional["SGFNode"] = parent
        if self.parent:
            self.parent.children.append(self)
        if parent and move:
            self.set_property(move.player, move.sgf(self.board_size))
        self._clear_cache()

    def _clear_cache(self) -> None:
        self.moves_cache: Optional[List[Move]] = None
        self._root: Optional["SGFNode"] = None
        self._depth: Optional[int] = None

    def __repr__(self):
        return f"SGFNode({dict(self.properties)})"

    def sgf_properties(self, **xargs) -> Dict:
        """Hook for subclasses to override/format additional properties for output."""
        return copy.deepcopy(self.properties)

    @staticmethod
    def order_children(children):
        """Hook for subclasses to override branch order."""
        return children

    @property
    def ordered_children(self):
        return self.order_children(self.children)

    @staticmethod
    def _escape_value(value):
        return re.sub(r"([\]\\])", r"\\\1", value) if isinstance(value, str) else value

    @staticmethod
    def _unescape_value(value):
        return re.sub(r"\\([\]\\])", r"\1", value) if isinstance(value, str) else value

    def sgf(self, **xargs) -> str:
        """Generates an SGF string, calling sgf_properties on each node."""

        def node_sgf_str(node):
            return ";" + "".join(
                [
                    prop + "".join(f"[{self._escape_value(v)}]" for v in values)
                    for prop, values in node.sgf_properties(**xargs).items()
                    if values
                ]
            )

        stack: List[Union[str, SGFNode]] = [")", self, "("]
        sgf_str = ""
        while stack:
            item = stack.pop()
            if isinstance(item, str):
                sgf_str += item
            else:
                # Mypy knows item is SGFNode here
                sgf_str += node_sgf_str(item)
                if len(item.children) == 1:
                    stack.append(item.children[0])
                elif item.children:
                    stack += sum(
                        [[")", c, "("] for c in item.ordered_children[::-1]], []
                    )
        return sgf_str

    def add_list_property(self, property: str, values: List):
        """Add values to the property list."""
        # Normalize property names (e.g., SiZe[19] -> SZ[19])
        normalized_property = re.sub("[a-z]", "", property)
        self._clear_cache()
        self.properties[normalized_property] += values

    def get_list_property(self, property, default=None) -> List:
        """Get the list of values for a property."""
        return self.properties.get(property, default)  # type: ignore

    def set_property(self, property: str, value: Any):
        """Set values for a property. Converts single values to a list."""
        if not isinstance(value, list):
            value = [value]
        self._clear_cache()
        self.properties[property] = value

    def get_property(self, property, default=None) -> Any:
        """Get the first value of a property."""
        return self.properties.get(property, [default])[0]

    def clear_property(self, property) -> Any:
        """Removes a property if it exists."""
        return self.properties.pop(property, None)

    @property
    def parent(self) -> Optional["SGFNode"]:
        """Returns the parent node."""
        return self._parent  # type: ignore

    @parent.setter
    def parent(self, parent_node):
        self._parent = parent_node
        self._root = None
        self._depth = None

    @property
    def root(self) -> "SGFNode":
        """Returns the root of the tree (cached)."""
        if self._root is None:
            self._root = self.parent.root if self.parent else self
        return self._root

    @property
    def depth(self) -> int:
        """Returns the depth of this node (root is 0)."""
        if self._depth is None:
            moves = self.moves
            if self.is_root:
                self._depth = 0
            else:
                assert self.parent is not None
                self._depth = self.parent.depth + len(moves)
        return self._depth

    @property
    def board_size(self) -> Tuple[int, int]:
        """Retrieves the board size (SZ property) from the root, defaulting to 19x19."""
        size = str(self.root.get_property("SZ", "19"))
        if ":" in size:
            x, y = map(int, size.split(":"))
        else:
            x = int(size)
            y = x
        return x, y

    @property
    def komi(self) -> Optional[float]:
        """Retrieves the komi (KM property) from the root."""
        try:
            val = self.root.get_property("KM", 6.5)
            km = float(val) if val is not None else None
        except ValueError:
            km = None
        return km

    @property
    def handicap(self) -> int:
        try:
            return int(self.root.get_property("HA", 0))
        except ValueError:
            return 0

    @property
    def ruleset(self) -> Optional[str]:
        """Retrieves the ruleset (RU property) from the root."""
        return self.root.get_property("RU", None)  # type: ignore

    @property
    def moves(self) -> List[Move]:
        """Returns all moves in the node."""
        if self.moves_cache is None:
            self.moves_cache = [
                Move.from_sgf(move, player=pl, board_size=self.board_size)
                for pl in Move.PLAYERS
                for move in self.get_list_property(pl, [])
            ]
        return self.moves_cache

    def _expanded_placements(self, player):
        sgf_pl = player if player is not None else "E"  # AE (Add Empty)
        placements = self.get_list_property("A" + sgf_pl, [])
        if not placements:
            return []
        to_be_expanded = [p for p in placements if ":" in p]
        board_size = self.board_size
        if to_be_expanded:
            coords = {
                Move.from_sgf(sgf_coord, player=player, board_size=board_size)
                for sgf_coord in placements
                if ":" not in sgf_coord
            }
            for p in to_be_expanded:
                from_coord, to_coord = [
                    Move.from_sgf(c, board_size=board_size) for c in p.split(":")[:2]
                ]
                for x in range(from_coord.coords[0], to_coord.coords[0] + 1):
                    for y in range(to_coord.coords[1], from_coord.coords[1] + 1):
                        if 0 <= x < board_size[0] and 0 <= y < board_size[1]:
                            coords.add(Move((x, y), player=player))
            return list(coords)
        else:
            return [
                Move.from_sgf(sgf_coord, player=player, board_size=board_size)
                for sgf_coord in placements
            ]

    @property
    def placements(self) -> List[Move]:
        """Returns all placements (AB/AW) in the node."""
        return [coord for pl in Move.PLAYERS for coord in self._expanded_placements(pl)]

    @property
    def clear_placements(self) -> List[Move]:
        """Returns all AE (clear) placements in the node."""
        return self._expanded_placements(None)  # type: ignore

    @property
    def move_with_placements(self) -> List[Move]:
        """Returns all moves (B/W) and placements (AB/AW) in the node."""
        return self.placements + self.moves

    @property
    def move(self) -> Optional[Move]:
        """Returns the single move for the node if it exists."""
        moves = self.moves
        if len(moves) == 1:
            return moves[0]
        return None

    @property
    def is_root(self) -> bool:
        """Returns true if node is a root."""
        return self.parent is None

    @property
    def is_pass(self) -> bool:
        """Returns true if the associated move is a pass."""
        return bool(not self.placements and self.move and self.move.is_pass)

    @property
    def empty(self) -> bool:
        """Returns true if node has no children or properties."""
        return not self.children and not self.properties

    @property
    def nodes_in_tree(self) -> List:
        """Returns all nodes in the tree rooted at this node."""
        stack = [self]
        nodes = []
        while stack:
            item = stack.pop(0)
            nodes.append(item)
            stack += item.children
        return nodes

    @property
    def nodes_from_root(self) -> List:
        """Returns all nodes from the root up to this node."""
        nodes = [self]
        n = self
        while not n.is_root:
            assert n.parent is not None
            n = n.parent
            nodes.append(n)
        return nodes[::-1]

    def play(self, move) -> "SGFNode":
        """Find an existing child or create a new one with the given move."""
        for c in self.children:
            if c.move and c.move == move:
                return c
        return self.__class__(parent=self, move=move)

    @property
    def initial_player(self):
        """Determine the initial player (B or W)."""
        root = self.root
        if "PL" in root.properties:
            return "B" if self.root.get_property("PL").upper().strip() == "B" else "W"
        elif root.children:
            for child in root.children:
                for color in "BW":
                    if color in child.properties:
                        return color
        if "AB" in self.properties and "AW" not in self.properties:
            return "W"
        else:
            return "B"

    @property
    def next_player(self):
        """Returns the player whose turn it is."""
        if self.is_root:
            return self.initial_player
        elif "B" in self.properties:
            return "W"
        elif "W" in self.properties:
            return "B"
        else:
            if self.parent is None:
                # Default if root and no PL property? Black usually?
                return "B"
            return self.parent.next_player

    @property
    def player(self) -> str:
        """Returns the player who made the last move."""
        if "B" in self.properties or (
            "AB" in self.properties and "W" not in self.properties
        ):
            return "B"
        else:
            return "W"

    def place_handicap_stones(self, n_handicaps: int, tygem: bool = False) -> None:
        board_size_x, board_size_y = self.board_size
        if min(board_size_x, board_size_y) < 3:
            return
        near_x = 3 if board_size_x >= 13 else min(2, board_size_x - 1)
        near_y = 3 if board_size_y >= 13 else min(2, board_size_y - 1)
        far_x = board_size_x - 1 - near_x
        far_y = board_size_y - 1 - near_y
        middle_x = board_size_x // 2
        middle_y = board_size_y // 2
        if n_handicaps > 9 and board_size_x == board_size_y:
            stones_per_row = math.ceil(math.sqrt(n_handicaps))
            spacing = (far_x - near_x) / (stones_per_row - 1)
            if spacing < near_x:
                far_x += 1
                near_x -= 1
                spacing = (far_x - near_x) / (stones_per_row - 1)
            coords = list(
                {math.floor(0.5 + near_x + i * spacing) for i in range(stones_per_row)}
            )
            stones = sorted(
                [(x, y) for x in coords for y in coords],
                key=lambda xy: -(
                    (xy[0] - (board_size_x - 1) / 2) ** 2
                    + (xy[1] - (board_size_y - 1) / 2) ** 2
                ),
            )
        else:  # max 9
            stones = [
                (far_x, far_y),
                (near_x, near_y),
                (far_x, near_y),
                (near_x, far_y),
            ]
            if n_handicaps % 2 == 1:
                stones.append((middle_x, middle_y))
            stones += [
                (near_x, middle_y),
                (far_x, middle_y),
                (middle_x, near_y),
                (middle_x, far_y),
            ]
        if tygem:
            stones[2], stones[3] = stones[3], stones[2]
        self.set_property(
            "AB",
            list(
                {
                    Move(stone).sgf(board_size=(board_size_x, board_size_y))
                    for stone in stones[:n_handicaps]
                }
            ),
        )


class SGF:
    DEFAULT_ENCODING = "UTF-8"

    _NODE_CLASS = SGFNode
    SGFPROP_PAT = re.compile(
        r"\s*(?:\(|\)|;|(\w+)((\s*\[([^\]\\]|\\.)*\])+))", flags=re.DOTALL
    )
    SGF_PAT = re.compile(r"\(;.*\)", flags=re.DOTALL)

    @classmethod
    def parse_sgf(cls, input_str) -> SGFNode:
        """Parse a string as SGF."""
        match = re.search(cls.SGF_PAT, input_str)
        clipped_str = match.group() if match else input_str
        root = cls(clipped_str).root
        # Fix weird FoxGo server KM values
        if "foxwq" in root.get_list_property("AP", []):
            if int(root.get_property("HA", 0)) >= 1:
                corrected_komi = 0.5
            elif root.get_property("RU").lower() in ["chinese", "cn"]:
                corrected_komi = 7.5
            else:
                corrected_komi = 6.5
            root.set_property("KM", corrected_komi)
            root.set_property("KM", corrected_komi)
        return cast(SGFNode, root)

    @classmethod
    def parse_file(
        cls, filename, encoding=None
    ) -> Any:  # Returns SGFNode but avoid cyclic Type issue or use 'SGFNode' string forward ref if needed
        """Parse a file as SGF, encoding will be detected if not given."""
        is_gib = filename.lower().endswith(".gib")
        is_ngf = filename.lower().endswith(".ngf")

        with open(filename, "rb") as f:
            bin_contents = f.read()
            if not encoding:
                if is_gib or is_ngf or b"AP[foxwq]" in bin_contents:
                    encoding = "utf8"
                else:  # sgf
                    match = re.search(rb"CA\[(.*?)\]", bin_contents)
                    if match:
                        encoding = match[1].decode("ascii", errors="ignore")
                    else:
                        encoding = chardet.detect(bin_contents[:300])["encoding"]
                        # Workaround for some compatibility issues for Windows-1252 and GB2312 encodings
                        if encoding == "Windows-1252" or encoding == "GB2312":
                            encoding = "GBK"
            try:
                decoded = bin_contents.decode(encoding=encoding, errors="ignore")
            except LookupError:
                decoded = bin_contents.decode(
                    encoding=cls.DEFAULT_ENCODING, errors="ignore"
                )
            if is_ngf:
                return cls.parse_ngf(decoded)
            if is_gib:
                return cls.parse_gib(decoded)
            else:  # sgf
                return cls.parse_sgf(decoded)
        return cls._NODE_CLASS()  # Fallback for structural safety

    def __init__(self, contents):
        self.contents = contents
        try:
            self.ix = self.contents.index("(") + 1
        except ValueError:
            raise ParseError(
                f"Parse error: Expected '(' at start, found {self.contents[:50]}"
            )
        self.root = self._NODE_CLASS()
        self._parse_branch(self.root)

    def _parse_branch(self, current_move: SGFNode):
        while self.ix < len(self.contents):
            match = re.match(self.SGFPROP_PAT, self.contents[self.ix :])
            if not match:
                break
            self.ix += len(match[0])
            matched_item = match[0].strip()
            if matched_item == ")":
                return
            if matched_item == "(":
                self._parse_branch(self._NODE_CLASS(parent=current_move))
            elif matched_item == ";":
                # Ignore ;) for old SGF
                useless = (
                    self.ix < len(self.contents)
                    and self.contents[self.ix :].strip() == ")"
                )
                # Ignore ; that generate empty nodes
                if not (current_move.empty or useless):
                    current_move = self._NODE_CLASS(parent=current_move)
            else:
                property, value = match[1], match[2].strip()[1:-1]
                values = re.split(r"\]\s*\[", value)
                current_move.add_list_property(
                    property, [SGFNode._unescape_value(v) for v in values]
                )
        if self.ix < len(self.contents):
            raise ParseError(
                f"Parse Error: unexpected character at {self.contents[self.ix:self.ix+25]}"
            )
        raise ParseError("Parse Error: expected ')' at end of input.")

    @classmethod
    def parse_ngf(cls, ngf):
        """
        Parse an NGF format file (NetGo/PandaNet game records).

        NGF is a line-based format with fixed positions for metadata:
        - Line 1: Board size
        - Lines 2-3: Player names with ranks
        - Line 5: Handicap
        - Line 7: Komi
        - Line 8: Date (YYYYMMDD)
        - Line 10: Game result
        - Remaining lines: Moves (PM B/W coordinate format)

        Args:
            ngf: Raw NGF file content as string.

        Returns:
            SGFNode: Root node of the parsed game tree.

        Raises:
            ParseError: If handicap is out of range or no moves found.
        """
        ngf = ngf.strip()
        lines = ngf.split("\n")

        try:
            boardsize = int(lines[1])
            handicap = int(lines[5])
            pw = lines[2].split()[0]
            pb = lines[3].split()[0]
            rawdate = lines[8][0:8]
            komi = float(lines[7])

            if handicap == 0 and int(komi) == komi:
                komi += 0.5

        except (IndexError, ValueError):
            boardsize = 19
            handicap = 0
            pw = ""
            pb = ""
            rawdate = ""
            komi = 0

        re = ""
        try:
            if "hite win" in lines[10]:
                re = "W+"
            elif "lack win" in lines[10]:
                re = "B+"
        except IndexError:
            pass

        if handicap < 0 or handicap > 9:
            raise ParseError(f"Handicap {handicap} out of range")

        root = cls._NODE_CLASS()
        node = root

        # Set root values...

        root.set_property("SZ", boardsize)

        if handicap >= 2:
            root.set_property("HA", handicap)
            root.place_handicap_stones(
                handicap, tygem=True
            )  # While this isn't Tygem, it uses the same layout

        if komi:
            root.set_property("KM", komi)

        if len(rawdate) == 8:
            ok = True
            for n in range(8):
                if rawdate[n] not in "0123456789":
                    ok = False
            if ok:
                date = rawdate[0:4] + "-" + rawdate[4:6] + "-" + rawdate[6:8]
                root.set_property("DT", date)

        if pw:
            root.set_property("PW", pw)
        if pb:
            root.set_property("PB", pb)

        if re:
            root.set_property("RE", re)

        # Main parser...

        for line in lines:
            line = line.strip().upper()

            if len(line) >= 7:
                if line[0:2] == "PM":
                    if line[4] in ["B", "W"]:
                        # Move format is similar to SGF, but uppercase and out-by-1

                        key = line[4]
                        raw_move = line[5:7].lower()
                        value = chr(ord(raw_move[0]) - 1) + chr(ord(raw_move[1]) - 1)

                        node = cls._NODE_CLASS(parent=node)
                        node.set_property(key, value)

        if len(root.children) == 0:  # We'll assume we failed in this case
            raise ParseError("Found no moves")

        return root

    # GIB parser adapted from https://github.com/fohristiwhirl/gofish/
    @classmethod
    def parse_gib(cls, gib):
        """
        Parse a GIB format file (Tygem/Baduk game records).

        GIB is a proprietary format used by Korean Go servers like Tygem.
        This parser extracts player names, ranks, game results, komi,
        date, handicap, and move sequences.

        Args:
            gib: Raw GIB file content as string.

        Returns:
            SGFNode: Root node of the parsed game tree.

        Raises:
            ParseError: If handicap is out of range or no valid nodes found.
        """

        def parse_player_name(raw):
            """
            Extract player name and rank from GIB format.
            GIB stores names as "PlayerName(Rank)" e.g. "Lee Sedol(9p)".
            """
            name = raw
            rank = ""
            foo = raw.split("(")
            if len(foo) == 2:
                if foo[1][-1] == ")":
                    name = foo[0].strip()
                    rank = foo[1][0:-1]
            return name, rank

        def gib_make_result(grlt, zipsu):
            """
            Convert GIB result codes to SGF result format.

            GIB result codes: 0=B+pts, 1=W+pts, 3=B+R, 4=W+R, 7=B+T, 8=W+T
            zipsu is the point difference * 10.
            """
            easycases = {3: "B+R", 4: "W+R", 7: "B+T", 8: "W+T"}

            if grlt in easycases:
                return easycases[grlt]

            if grlt in [0, 1]:
                return "{}+{}".format("B" if grlt == 0 else "W", zipsu / 10)

            return ""

        def gib_get_result(line, grlt_regex, zipsu_regex):
            """Extract game result from a GIB metadata line using regex patterns."""
            try:
                g_match = re.search(grlt_regex, line)
                z_match = re.search(zipsu_regex, line)
                if not g_match or not z_match:
                    return ""
                grlt = int(g_match.group(1))
                zipsu = int(z_match.group(1))
            except:  # noqa E722
                return ""
            return gib_make_result(grlt, zipsu)

        root = cls._NODE_CLASS()
        node = root

        lines = gib.split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("\\[GAMEBLACKNAME=") and line.endswith("\\]"):
                s = line[16:-2]
                name, rank = parse_player_name(s)
                if name:
                    root.set_property("PB", name)
                if rank:
                    root.set_property("BR", rank)

            if line.startswith("\\[GAMEWHITENAME=") and line.endswith("\\]"):
                s = line[16:-2]
                name, rank = parse_player_name(s)
                if name:
                    root.set_property("PW", name)
                if rank:
                    root.set_property("WR", rank)

            if line.startswith("\\[GAMEINFOMAIN="):
                result = gib_get_result(line, r"GRLT:(\d+),", r"ZIPSU:(\d+),")
                if result:
                    root.set_property("RE", result)
                    try:
                        match = re.search(r"GONGJE:(\d+),", line)
                        if match:
                            komi = int(match.group(1)) / 10
                            if komi:
                                root.set_property("KM", komi)
                    except:  # noqa E722
                        pass

            if line.startswith("\\[GAMETAG="):
                if "DT" not in root.properties:
                    try:
                        match = re.search(r"C(\d\d\d\d):(\d\d):(\d\d)", line)
                        if match:
                            date = "{}-{}-{}".format(
                                match.group(1), match.group(2), match.group(3)
                            )
                            root.set_property("DT", date)
                    except:  # noqa E722
                        pass

                if "RE" not in root.properties:
                    result = gib_get_result(line, r",W(\d+),", r",Z(\d+),")
                    if result:
                        root.set_property("RE", result)

                if "KM" not in root.properties:
                    try:
                        match = re.search(r",G(\d+),", line)
                        if match:
                            komi = int(match.group(1)) / 10
                            if komi:
                                root.set_property("KM", komi)
                    except:  # noqa E722
                        pass

            if line[0:3] == "INI":
                if node is not root:
                    raise ParseError("Node is not root")
                setup = line.split()
                try:
                    handicap = int(setup[3])
                except ParseError:
                    continue

                if handicap < 0 or handicap > 9:
                    raise ParseError(f"Handicap {handicap} out of range")

                if handicap >= 2:
                    root.set_property("HA", handicap)
                    root.place_handicap_stones(handicap, tygem=True)

            if line[0:3] == "STO":
                move = line.split()
                key = "B" if move[3] == "1" else "W"
                try:
                    x = int(move[4])
                    y = 18 - int(move[5])
                    if not (0 <= x < 19 and 0 <= y < 19):
                        raise ParseError(
                            f"Coordinates for move ({x},{y}) out of range on line {line}"
                        )
                    value = Move(coords=(x, y)).sgf(board_size=(19, 19))
                except IndexError:
                    continue

                node = cls._NODE_CLASS(parent=node)
                node.set_property(key, value)

        if len(root.children) == 0:  # We'll assume we failed in this case
            raise ParseError("No valid nodes found")

        return root
