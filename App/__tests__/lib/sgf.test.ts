import { toSgf, fromSgf, toLinearSgf, getInitialDisplayNode } from '@game/lib/sgf';
import { RootNode, MoveNode } from '../../lib/types';

describe('sgf.ts', () => {
  const makeNode = (id: number, row: number, col: number, player: number, comment?: string): MoveNode => ({
    id,
    children: [],
    move: { row, col, player, comment }
  });

  test('toSgf generates minimal SGF for single line game', () => {
    const root: RootNode = { id: 0, children: [] };
    const n1 = makeNode(1, 0, 0, 1); // B[aa]
    const n2 = makeNode(2, 18, 18, 2, 'Winrate: 55.5%, Score: 1.2'); // W[ss]
    root.children.push(n1);
    n1.children.push(n2);

    const sgf = toSgf(root);
    expect(sgf.startsWith('(;GM[1]FF[4]SZ[19]CA[UTF-8]')).toBe(true);
    expect(sgf).toContain(';B[aa]');
    expect(sgf).toContain(';W[ss]C[Winrate: 55.5%, Score: 1.2]');
    expect(sgf.endsWith(')')).toBe(true);
  });

  test('fromSgf parses moves, comments, winrate and score', () => {
    const sgf = '(;GM[1]FF[4]SZ[19]CA[UTF-8];B[aa];W[ss]C[Winrate: 55.5%, Score: 1.2])';
    const root = fromSgf(sgf);

    expect(root.children.length).toBe(1);
    const first = root.children[0]!;
    expect(first.children.length).toBe(1);
    const second = first.children[0]!;

    expect(first.move.player).toBe(1);
    expect(first.move.row).toBe(0);
    expect(first.move.col).toBe(0);

    expect(second.move.player).toBe(2);
    expect(second.move.row).toBe(18);
    expect(second.move.col).toBe(18);
    expect(second.move.comment).toContain('Winrate');
    expect(second.move.winrate).toBeCloseTo(55.5, 1);
    expect(second.move.score).toBeCloseTo(1.2, 1);
  });

  test('fromSgf handles variations', () => {
    const sgf = '(;GM[1]FF[4]SZ[19]CA[UTF-8](;B[dd];W[pp])(;B[qq];W[dc]))';
    const root = fromSgf(sgf);
    expect(root.children.length).toBe(2);
    expect(root.children[1]!.children.length).toBe(1);
  });

  test('fromSgf handles AB/AW setup stones', () => {
    const sgf = '(;GM[1]SZ[19];AB[dd][pp]AW[dd][qq];B[jj])';
    // Wait, AB[dd] and AW[dd] is impossible but legal SGF parsing.

    const root = fromSgf(sgf);
    expect(root.children.length).toBe(1);
    const node1 = root.children[0] as MoveNode;

    // Should parse AB/AW
    expect(node1.move.setupStones).toBeDefined();
    // 2 black, 2 white (3 total points defined, one overwrite?)
    // The parser pushes them all.
    expect(node1.move.setupStones?.length).toBeGreaterThan(0);

    // Check B[jj] is there as a child or as the move itself?
    // Logic: parseNode consumes properties. AB/AW are properties. B is property.
    // If one node has AB and B, it's one move node with setup stones.

    expect(node1.move.player).toBe(1); // B
  });

  test('toLinearSgf creates linear path to target', () => {
    const root: RootNode = { id: 0, children: [] };
    const n1 = makeNode(1, 0, 0, 1); // B[aa]
    const n2 = makeNode(2, 1, 1, 2); // W[bb]
    const n2_var = makeNode(3, 2, 2, 2); // W[cc] variation

    n1.parent = root;
    root.children.push(n1);

    n2.parent = n1;
    n2_var.parent = n1;
    n1.children.push(n2, n2_var);

    // Path to n2_var
    const sgf = toLinearSgf(root, n2_var);

    expect(sgf).toContain('B[aa]');
    expect(sgf).toContain('W[cc]');
    expect(sgf).not.toContain('W[bb]'); // Should ignore the other branch
  });

  test('getInitialDisplayNode returns setup node if present', () => {
    const root: RootNode = { id: 0, children: [] };
    const setupNode = makeNode(1, -1, -1, 0); // Player 0 = Empty/Setup
    setupNode.move.setupStones = [{ player: 1, row: 3, col: 3 }];
    setupNode.parent = root;

    root.children.push(setupNode);

    const initial = getInitialDisplayNode(root);
    expect(initial).toBe(setupNode);
  });

  test('getInitialDisplayNode returns root if no setup node', () => {
    const root: RootNode = { id: 0, children: [] };
    const normalMove = makeNode(1, 3, 3, 1);
    normalMove.parent = root;
    root.children.push(normalMove);

    const initial = getInitialDisplayNode(root);
    expect(initial).toBe(root);
  });

  test('toSgf handles setup stones', () => {
    const root: RootNode = { id: 0, children: [] };
    const node = makeNode(1, 0, 0, 0); // Setup only
    node.move.setupStones = [{ player: 1, row: 0, col: 0 }];
    node.parent = root;
    root.children.push(node);

    const sgf = toSgf(root);
    expect(sgf).toContain('AB[aa]');
  });

  test('toLinearSgf handles setup stones', () => {
    const root: RootNode = { id: 0, children: [] };
    const node = makeNode(1, 0, 0, 0); // Setup only
    node.move.setupStones = [{ player: 1, row: 0, col: 0 }];
    node.parent = root;
    root.children.push(node);

    const sgf = toLinearSgf(root, node);
    expect(sgf).toContain('AB[aa]');
  });

  test('toSgf handles multiple variations at root', () => {
    const root: RootNode = { id: 0, children: [] };
    const var1 = makeNode(1, 3, 3, 1);
    const var2 = makeNode(2, 15, 15, 1);
    var1.parent = root;
    var2.parent = root;
    root.children.push(var1, var2);

    const sgf = toSgf(root);
    expect(sgf).toContain('(;B[dd])');
    expect(sgf).toContain('(;B[pp])');
  });

  test('toSgf handles nested variations', () => {
    const root: RootNode = { id: 0, children: [] };
    const n1 = makeNode(1, 3, 3, 1);
    const n2a = makeNode(2, 15, 15, 2);
    const n2b = makeNode(3, 16, 16, 2);
    n1.parent = root;
    n2a.parent = n1;
    n2b.parent = n1;
    root.children.push(n1);
    n1.children.push(n2a, n2b);

    const sgf = toSgf(root);
    expect(sgf).toContain('B[dd]');
    expect(sgf).toContain('(;W[pp])');
    expect(sgf).toContain('(;W[qq])');
  });

  test('toSgf handles comment with escape characters', () => {
    const root: RootNode = { id: 0, children: [] };
    const n1 = makeNode(1, 0, 0, 1, 'Test with ] bracket and \\ backslash');
    n1.parent = root;
    root.children.push(n1);

    const sgf = toSgf(root);
    expect(sgf).toContain('C[Test with \\] bracket and \\\\ backslash]');
  });

  test('toSgf handles root setup stones', () => {
    const root: RootNode = {
      id: 0, children: [], setupStones: [
        { player: 1, row: 3, col: 3 },
        { player: 2, row: 15, col: 15 }
      ]
    };

    const sgf = toSgf(root);
    expect(sgf).toContain('AB[dd]');
    expect(sgf).toContain('AW[pp]');
  });

  test('toLinearSgf with setup stones and move on same node', () => {
    const root: RootNode = { id: 0, children: [] };
    const node = makeNode(1, 3, 3, 1);
    node.move.setupStones = [{ player: 1, row: 0, col: 0 }];
    node.parent = root;
    root.children.push(node);

    const sgf = toLinearSgf(root, node);
    expect(sgf).toContain('AB[aa]');
    expect(sgf).toContain('B[dd]');
  });

  test('toLinearSgf handles root setup stones', () => {
    const root: RootNode = {
      id: 0, children: [], setupStones: [
        { player: 1, row: 3, col: 3 },
        { player: 2, row: 15, col: 15 }
      ]
    };
    const node = makeNode(1, 16, 16, 1);
    node.parent = root;
    root.children.push(node);

    const sgf = toLinearSgf(root, node);
    expect(sgf).toContain('AB[dd]');
    expect(sgf).toContain('AW[pp]');
    expect(sgf).toContain('B[qq]');
  });

  test('fromSgf handles empty SGF', () => {
    const sgf = '(;GM[1]SZ[19])';
    const root = fromSgf(sgf);
    expect(root.id).toBe(0);
    expect(root.children.length).toBe(0);
  });

  test('fromSgf handles deeply nested variations', () => {
    const sgf = '(;GM[1]SZ[19];B[dd](;W[pp](;B[dp])(;B[pd]))(;W[dp]))';
    const root = fromSgf(sgf);
    expect(root.children.length).toBe(1);
    const first = root.children[0] as MoveNode;
    expect(first.children.length).toBe(2);
  });

  test('fromSgf handles escape sequences in comments', () => {
    const sgf = '(;GM[1]SZ[19];B[dd]C[Test \\] bracket])';
    const root = fromSgf(sgf);
    const first = root.children[0] as MoveNode;
    expect(first.move.comment).toContain('] bracket');
  });

  test('fromSgf handles multiple property values', () => {
    const sgf = '(;GM[1]SZ[19];AB[aa][bb][cc])';
    const root = fromSgf(sgf);
    // Should have setup stones
    expect(root.setupStones?.length).toBeGreaterThan(0);
  });

  test('fromSgf handles whitespace', () => {
    const sgf = '(\n;GM[1]\n  SZ[19]\n;\n  B[dd]\n)';
    const root = fromSgf(sgf);
    expect(root.children.length).toBe(1);
  });

  test('fromSgf handles unknown characters', () => {
    const sgf = '(;GM[1]SZ[19]&^%;B[dd])';
    const root = fromSgf(sgf);
    expect(root.children.length).toBe(1);
  });

  test('fromSgf skips root node with only GM/SZ properties', () => {
    const sgf = '(;GM[1]FF[4]SZ[19]CA[UTF-8];B[dd])';
    const root = fromSgf(sgf);
    expect(root.children.length).toBe(1);
    const first = root.children[0] as MoveNode;
    expect(first.move.player).toBe(1);
    expect(first.move.col).toBe(3);
    expect(first.move.row).toBe(3);
  });

  test('fromSgf handles pass move', () => {
    const sgf = '(;GM[1]SZ[19];B[dd];W[])'; // Pass
    const root = fromSgf(sgf);
    expect(root.children.length).toBe(1);
  });

  test('fromSgf handles score without decimal', () => {
    const sgf = '(;GM[1]SZ[19];B[dd]C[Winrate: 55%, Score: 2])';
    const root = fromSgf(sgf);
    const first = root.children[0] as MoveNode;
    expect(first.move.winrate).toBe(55);
    expect(first.move.score).toBe(2);
  });

  test('getInitialDisplayNode returns root for empty game', () => {
    const root: RootNode = { id: 0, children: [] };
    const initial = getInitialDisplayNode(root);
    expect(initial).toBe(root);
  });

  test('getInitialDisplayNode returns root for normal first move', () => {
    const root: RootNode = { id: 0, children: [] };
    const normalMove = makeNode(1, 3, 3, 1);
    normalMove.parent = root;
    root.children.push(normalMove);

    const initial = getInitialDisplayNode(root);
    expect(initial).toBe(root);
  });
});
