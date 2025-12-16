// GoAnalysisApp/lib/sgf.ts

import { Move, MoveNode, RootNode, isMoveNode } from '@/lib/types';

/**
 * Serializes a game tree to SGF format.
 * @param root - The root node of the game tree
 * @returns A valid SGF string representing the entire game with all variations
 * @example
 * const sgf = toSgf(gameRoot);
 * // Returns: "(;GM[1]FF[4]SZ[19]CA[UTF-8];B[pd];W[dp]...)"
 */
export const toSgf = (root: RootNode): string => {
  // Helper to convert setup stones to AB/AW properties
  const setupStonesToSgf = (stones: { player: number; row: number; col: number }[] | undefined): string => {
    if (!stones || stones.length === 0) return '';

    const blackStones: string[] = [];
    const whiteStones: string[] = [];

    for (const stone of stones) {
      const col = String.fromCharCode(97 + stone.col);
      const row = String.fromCharCode(97 + stone.row);
      if (stone.player === 1) {
        blackStones.push(`[${col}${row}]`);
      } else if (stone.player === 2) {
        whiteStones.push(`[${col}${row}]`);
      }
    }

    let result = '';
    if (blackStones.length > 0) result += 'AB' + blackStones.join('');
    if (whiteStones.length > 0) result += 'AW' + whiteStones.join('');
    return result;
  };

  const buildSgfRecursive = (node: MoveNode, isFirstNode: boolean = false): string => {
    const { move } = node;
    let sgfPart = ';';

    // Handle setup stones (from image recognition)
    if (move.setupStones && move.setupStones.length > 0 && isFirstNode) {
      sgfPart += setupStonesToSgf(move.setupStones);
    } else {
      // Regular move
      const player = move.player === 1 ? 'B' : 'W';
      const col = String.fromCharCode(97 + move.col);
      const row = String.fromCharCode(97 + move.row);
      sgfPart += `${player}[${col}${row}]`;
    }

    if (move.comment) {
      const comment = move.comment.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
      sgfPart += `C[${comment}]`;
    }
    if (node.children.length === 1) {
      const firstChild = node.children[0];
      if (firstChild) sgfPart += buildSgfRecursive(firstChild);
    } else if (node.children.length > 1) {
      for (const childNode of node.children) {
        sgfPart += `(${buildSgfRecursive(childNode)})`;
      }
    }
    return sgfPart;
  };
  let gameTree = '';
  if (root.children.length > 1) {
    for (const childNode of root.children) {
      gameTree += `(${buildSgfRecursive(childNode, true)})`;
    }
  } else if (root.children.length === 1) {
    const firstChild = root.children[0];
    if (firstChild) gameTree = buildSgfRecursive(firstChild, true);
  }

  const rootSetup = root.setupStones ? setupStonesToSgf(root.setupStones) : '';
  return `(;GM[1]FF[4]SZ[19]CA[UTF-8]${rootSetup}${gameTree})`;
};

/**
 * Generates a linear SGF from root to targetNode, ignoring other variations.
 * Used for analyzing a specific variation path.
 */
export const toLinearSgf = (root: RootNode, targetNode: MoveNode | RootNode): string => {
  // 1. Collect path nodes
  const path: MoveNode[] = [];
  let curr: MoveNode | RootNode | undefined = targetNode;
  while (isMoveNode(curr)) {
    path.unshift(curr);
    curr = curr.parent;
  }

  // 2. Build SGF Content
  const setupStonesToSgf = (stones: { player: number; row: number; col: number }[] | undefined): string => {
    if (!stones || stones.length === 0) return '';
    const blackStones: string[] = [];
    const whiteStones: string[] = [];
    for (const stone of stones) {
      const col = String.fromCharCode(97 + stone.col);
      const row = String.fromCharCode(97 + stone.row);
      if (stone.player === 1) blackStones.push(`[${col}${row}]`);
      else if (stone.player === 2) whiteStones.push(`[${col}${row}]`);
    }
    let result = '';
    if (blackStones.length > 0) result += 'AB' + blackStones.join('');
    if (whiteStones.length > 0) result += 'AW' + whiteStones.join('');
    return result;
  };

  // 3. Determine root setup stones FIRST (before building content)
  // Check both root.setupStones and first node's setup stones (from parsed SGF)
  let rootSetup = '';
  let firstNodeSetupHandled = false;

  if (root.setupStones && root.setupStones.length > 0) {
    rootSetup = setupStonesToSgf(root.setupStones);
  } else if (path.length > 0 && path[0]?.move.setupStones && path[0].move.setupStones.length > 0) {
    // First node has setup stones but they weren't lifted to root (e.g., direct board recognition)
    rootSetup = setupStonesToSgf(path[0].move.setupStones);
    // Mark that we've already handled the first node's setup stones
    firstNodeSetupHandled = true;
  }

  // 4. Build SGF content from path nodes
  let sgfContent = '';
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    if (!node) continue;

    const { move } = node;
    const isFirstNode = i === 0;

    // Check if this is a setup-only node (no real move)
    const isSetupOnly = move.player === 0 || (move.row < 0 && move.col < 0);

    // Skip first node entirely if it's setup-only and we already handled its setup stones
    if (isFirstNode && firstNodeSetupHandled && isSetupOnly) {
      continue;
    }

    sgfContent += ';';

    // Check if this node has setup stones that need to be written
    if (move.setupStones && move.setupStones.length > 0) {
      // Only output setup stones if they weren't already handled in rootSetup
      if (!(isFirstNode && firstNodeSetupHandled)) {
        sgfContent += setupStonesToSgf(move.setupStones);
      }
    }

    // Always output the move if it's a real move (player 1 or 2, valid coordinates)
    if (move.player !== 0 && move.row >= 0 && move.col >= 0) {
      const player = move.player === 1 ? 'B' : 'W';
      const col = String.fromCharCode(97 + move.col);
      const row = String.fromCharCode(97 + move.row);
      sgfContent += `${player}[${col}${row}]`;
    }
  }

  return `(;GM[1]FF[4]SZ[19]CA[UTF-8]${rootSetup}${sgfContent})`;
};

// Lexer & Parser Implementation

enum TokenType {
  LeftParen,
  RightParen,
  SemiColon,
  PropIdent,
  PropValue,
  EOF
}

type Token = {
  type: TokenType;
  value: string;
  pos: number;
};

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char && /\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: TokenType.LeftParen, value: '(', pos: i });
      i++;
    } else if (char === ')') {
      tokens.push({ type: TokenType.RightParen, value: ')', pos: i });
      i++;
    } else if (char === ';') {
      tokens.push({ type: TokenType.SemiColon, value: ';', pos: i });
      i++;
    } else if (char && /[A-Z]/.test(char)) {
      let ident = '';
      while (i < input.length) {
        const c = input[i];
        if (c && /[A-Z]/.test(c)) {
          ident += c;
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: TokenType.PropIdent, value: ident, pos: i - ident.length });
    } else if (char === '[') {
      let value = '';
      i++; // Skip '['
      let start = i;
      while (i < input.length) {
        if (input[i] === '\\') {
          // Handle escape sequence
          i++;
          if (i < input.length) {
            value += input[i];
            i++;
          }
        } else if (input[i] === ']') {
          break;
        } else {
          value += input[i];
          i++;
        }
      }
      tokens.push({ type: TokenType.PropValue, value, pos: start });
      if (i < input.length) i++; // Skip ']'
    } else {
      // Unknown character, skip or throw? For robustness, we skip.
      i++;
    }
  }
  tokens.push({ type: TokenType.EOF, value: '', pos: i });
  return tokens;
};

class SgfParser {
  private tokens: Token[];
  private pos: number = 0;
  private nodeIdCounter: number = 1;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', pos: this.pos };
  }

  private consume(type?: TokenType): Token {
    const token = this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', pos: this.pos };
    if (type !== undefined && token.type !== type) {
      if (token.type === TokenType.EOF) return token;
    }
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return token;
  }

  public parse(): RootNode {
    const root: RootNode = { id: 0, children: [] };

    // SGF usually starts with '('
    while (this.peek().type === TokenType.LeftParen) {
      this.parseGameTree(root);
    }

    return root;
  }

  private parseGameTree(parent: RootNode | MoveNode) {
    this.consume(TokenType.LeftParen);

    // Sequence
    const sequenceNodes = this.parseSequence(parent);
    const lastSequenceNode = sequenceNodes[sequenceNodes.length - 1];
    const lastNode: RootNode | MoveNode = lastSequenceNode ?? parent;

    // Variations (children of the last node in the sequence)
    while (this.peek().type === TokenType.LeftParen) {
      this.parseGameTree(lastNode);
    }

    // Consume RightParen if present
    if (this.peek().type === TokenType.RightParen) {
      this.consume(TokenType.RightParen);
    }
  }

  private parseSequence(parent: RootNode | MoveNode): MoveNode[] {
    const nodes: MoveNode[] = [];
    let currentParent = parent;

    while (this.peek().type === TokenType.SemiColon) {
      const node = this.parseNode(currentParent);

      // Feature: If this is the first node of the Root and it has setup stones,
      // lift them to the RootNode so the starting position is not empty.
      if (nodes.length === 0 && !isMoveNode(parent) && node.move.setupStones && node.move.setupStones.length > 0) {
        parent.setupStones = node.move.setupStones;
        // If it's pure setup (no move), skip creating a child node.
        if (node.move.player === 0) {
          continue;
        }
      }

      // Compatibility: Skip nodes that are not actual moves AND have no setup stones
      // This allows board recognition results (setup only) to be preserved
      if (node.move.player === 0 && (!node.move.setupStones || node.move.setupStones.length === 0)) {
        // We skip adding this node to the tree.
        // The next node in the sequence will be attached to the currentParent (which hasn't changed).
        continue;
      }

      nodes.push(node);
      currentParent = node;

      // If parent was a RootNode, add to its children
      if (!('move' in parent) && nodes.length === 1) {
        parent.children.push(node);
      } else if (nodes.length > 1) {
        // Previous node in sequence is parent of current
        const prevNode = nodes[nodes.length - 2];
        if (prevNode) prevNode.children.push(node);
      } else if ('move' in parent && nodes.length === 1) {
        // Parent was a MoveNode
        parent.children.push(node);
      }
    }
    return nodes;
  }

  private parseNode(parent: RootNode | MoveNode): MoveNode {
    this.consume(TokenType.SemiColon);

    const move: Move = { row: -1, col: -1, player: 0 }; // Default empty
    let setupStones: { player: number; row: number; col: number }[] = [];

    while (this.peek().type === TokenType.PropIdent) {
      const ident = this.consume(TokenType.PropIdent).value;
      const values: string[] = [];

      while (this.peek().type === TokenType.PropValue) {
        values.push(this.consume(TokenType.PropValue).value);
      }

      // Process properties
      if (ident === 'B' || ident === 'W') {
        move.player = ident === 'B' ? 1 : 2;
        const firstValue = values[0];
        if (firstValue && firstValue.length >= 2) {
          move.col = firstValue.charCodeAt(0) - 'a'.charCodeAt(0);
          move.row = firstValue.charCodeAt(1) - 'a'.charCodeAt(0);
        }
      } else if (ident === 'AB' || ident === 'AW') {
        // AddBlack (AB) or AddWhite (AW) - setup stones
        const player = ident === 'AB' ? 1 : 2;
        for (const coord of values) {
          if (coord && coord.length >= 2) {
            setupStones.push({
              player,
              col: coord.charCodeAt(0) - 'a'.charCodeAt(0),
              row: coord.charCodeAt(1) - 'a'.charCodeAt(0)
            });
          }
        }
      } else if (ident === 'C') {
        const firstValue = values[0];
        if (firstValue) {
          move.comment = firstValue;
          this.parseCommentData(move, firstValue);
        }
      }
      // Other properties (GM, SZ, etc.) are ignored for now
    }

    // If we have setup stones (AB/AW), create a special setup move
    if (setupStones.length > 0 && move.player === 0) {
      // Use first stone as the "move" and store others in setupStones
      const firstStone = setupStones[0];
      if (firstStone) {
        move.player = firstStone.player;
        move.row = firstStone.row;
        move.col = firstStone.col;
        move.setupStones = setupStones;
      }
    }

    return {
      id: this.nodeIdCounter++,
      parent: parent,
      children: [],
      move: move
    };
  }

  private parseCommentData(move: Move, comment: string) {
    const winrateMatch = comment.match(/Win(?:rate)?:\s*([\d.-]+)%/);
    if (winrateMatch && winrateMatch[1]) {
      move.winrate = parseFloat(winrateMatch[1]);
    }
    const scoreMatch = comment.match(/Score:\s*([\d.-]+)/);
    if (scoreMatch && scoreMatch[1]) {
      move.score = parseFloat(scoreMatch[1]);
    }
  }
}

/**
 * Parses an SGF string and returns the root node of the game tree.
 * Handles various SGF property types including moves (B, W), setup stones (AB, AW),
 * comments with embedded analysis data (winrate, score), and game metadata.
 *
 * @param sgfString - Raw SGF content (supports standard SGF format)
 * @returns RootNode containing the parsed game tree with all variations
 * @throws Will not throw but may return empty tree for malformed SGF
 * @example
 * const root = fromSgf("(;GM[1]SZ[19];B[pd];W[dp])");
 * // Returns: { id: 0, children: [{ move: { player: 1, row: 3, col: 15 }, ... }] }
 */
export const fromSgf = (sgfString: string): RootNode => {
  const tokens = tokenize(sgfString);
  const parser = new SgfParser(tokens);
  return parser.parse();
};

/**
 * Determines the initial node to display.
 * If the first child of the root is a setup-only node (common in image recognition SGFs),
 * we should start there instead of the empty root to show the stones immediately.
 */
export const getInitialDisplayNode = (root: RootNode): MoveNode | RootNode => {
  if (root.children.length > 0) {
    const firstChild = root.children[0];
    // Check if it's a setup node: has setup stones but NO player move (player 0)
    // Note: regular moves have player 1 or 2.
    if (
      firstChild &&
      firstChild.move &&
      firstChild.move.setupStones &&
      firstChild.move.setupStones.length > 0
    ) {
      return firstChild;
    }
  }
  return root;
};
