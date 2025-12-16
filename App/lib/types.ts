// GoAnalysisApp/lib/types.ts

export type Stone = {
  row: number;
  col: number;
};

export type AIAlternative = {
  move: string;
  winrate: number;
  pointsLost: number;
  score?: number;
};

export type Move = Stone & {
  player: number;
  comment?: string;
  captured?: Stone[];
  winrate?: number;
  score?: number;
  delta?: number;
  visits?: number;  // Analysis visit count (for opacity calculation)
  aiAlternatives?: AIAlternative[];
  isNextBest?: boolean;
  isPlayed?: boolean;
  // Setup stones from AB/AW properties (board recognition)
  setupStones?: { player: number; row: number; col: number }[];
};

/**
 * Cached board state for O(1) navigation.
 * Stored on each node after first computation.
 */
export type CachedBoardState = {
  board: number[][];
  capturedByBlack: number;
  capturedByWhite: number;
};

export type MoveNode = {
  id: number;
  parent?: MoveNode | RootNode;
  children: MoveNode[];
  move: Move;
  // Cached board state for fast navigation (lazy-computed)
  _cachedBoardState?: CachedBoardState;
};

export type RootNode = {
  id: number;
  children: MoveNode[];
  setupStones?: { player: number; row: number; col: number }[];
};

export function isMoveNode(node: MoveNode | RootNode | undefined | null): node is MoveNode {
  return !!node && 'move' in node;
}

export type TopMove = {
  move: string;
  winrate: number;
  scoreLead: number;
  visits?: number;
  pv?: string[];
};
