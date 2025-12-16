import { renderHook, act } from '@testing-library/react-native';
import { useGameEngine } from '@analysis/hooks/useGameEngine';
import { RootNode, MoveNode } from '../../lib/types';
import { useGoBoardLogic } from '@analysis/hooks/useGoBoardLogic';
import * as goRules from '@game/lib/goRules';
import { useGameContext } from '@game/context/GameContext';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { useError } from '@game/context/ErrorContext';
import * as saveGame from '../../lib/saveGame';

// Mock contexts - Jest hoists these above imports automatically
jest.mock('@game/context/GameContext');
jest.mock('@settings/context/SettingsContext');
jest.mock('@game/context/ErrorContext', () => ({
    useError: jest.fn(),
}));
jest.mock('../../lib/saveGame', () => ({
    exportSgfFile: jest.fn(),
}));
jest.mock('@analysis/hooks/useGoBoardLogic', () => ({
    useGoBoardLogic: jest.fn(),
}));
jest.mock('@game/lib/goRules', () => ({
    findCaptures: jest.fn(() => []),
    isValidMove: jest.fn(() => true),
    hashBoard: jest.fn(() => 'hash'),
}));


describe('useGameEngine', () => {
    const mockSetCurrentNode = jest.fn();
    let mockRootNode: RootNode;
    const mockShowError = jest.fn();

    const makeNode = (id: number, parent: any): MoveNode => ({
        id,
        parent,
        children: [],
        move: { row: 0, col: 0, player: 1 }
    });

    beforeEach(() => {
        mockRootNode = { id: 0, children: [] };
        jest.clearAllMocks();
        (useGameContext as jest.Mock).mockReturnValue({
            rootNode: mockRootNode,
            currentNode: mockRootNode,
            setCurrentNode: mockSetCurrentNode,
            scrubbingNode: null,
            analysisMode: 'winrate',
            dispatchGameAction: jest.fn(),
        });
        (useSettingsContext as jest.Mock).mockReturnValue({
            errorThresholdEnabled: false,
            errorThresholdMode: 'winrate',
            winrateThreshold: 5,
            scoreThreshold: 2,
            ghostStoneCount: 3,
            alternativeMoveCount: 5
        });
        (useError as jest.Mock).mockReturnValue({
            showError: mockShowError,
            clearError: jest.fn(),
            error: null,
        });
        (useGoBoardLogic as jest.Mock).mockReturnValue({
            board: Array(19).fill(0).map(() => Array(19).fill(0)),
            capturedByBlack: 0,
            capturedByWhite: 0,
        });
        (goRules.isValidMove as jest.Mock).mockReturnValue(true);
    });

    it('initializes with empty board', () => {
        const { result } = renderHook(() => useGameEngine());
        expect(result.current.board.flat().every(c => c === 0)).toBe(true);
    });

    it('handles placing a stone (new move)', () => {
        const { result } = renderHook(() => useGameEngine());
        console.log('Test: Calling handleCellPress');
        act(() => { result.current.handleCellPress(3, 3); }); // D4
        console.log('Test: Called handleCellPress');

        expect(mockSetCurrentNode).toHaveBeenCalled();
        const newNode = mockSetCurrentNode.mock.calls[0][0];
        expect(newNode.move.row).toBe(3);
        expect(newNode.move.col).toBe(3);
        expect(newNode.move.player).toBe(1); // Black first
    });

    it('selects existing variation on cell press', () => {
        const moveNode = makeNode(1, mockRootNode);
        moveNode.move = { row: 15, col: 15, player: 1 };
        mockRootNode.children.push(moveNode);

        const { result } = renderHook(() => useGameEngine());
        act(() => { result.current.handleCellPress(15, 15); });

        expect(mockSetCurrentNode).toHaveBeenCalledWith(moveNode);
        // Should not create new node (called only once with existing node)
        expect(mockSetCurrentNode).toHaveBeenCalledTimes(1);
    });

    it('prevents valid suicice/invalid moves', () => {
        // Mock a board setup where 0,0 is surrounded (suicide) logic handled by useGoBoardLogic/isValidMove?
        // But useGameEngine calls isValidMove.
        // Let's rely on isValidMove mock or behavior.
        // Typically suicide is complex to setup. Let's try placing on top of existing stone.

        // Setup: Current node has played 0,0.
        const moveNode = makeNode(1, mockRootNode);
        moveNode.move = { row: 0, col: 0, player: 1 };

        (useGameContext as jest.Mock).mockReturnValue({
            rootNode: mockRootNode,
            currentNode: moveNode,
            setCurrentNode: mockSetCurrentNode,
            scrubbingNode: null,
            analysisMode: 'winrate',
            dispatchGameAction: jest.fn(),
        });
        (goRules.isValidMove as jest.Mock).mockReturnValue(false);

        const { result } = renderHook(() => useGameEngine());

        act(() => { result.current.handleCellPress(0, 0); }); // Occupied

        expect(mockSetCurrentNode).not.toHaveBeenCalled();
        expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('Invalid Move'), 'warning');
    });

    it('navigates moves (next, prev)', () => {
        const n1 = makeNode(1, mockRootNode);
        mockRootNode.children.push(n1);
        const n2 = makeNode(2, n1);
        n1.children.push(n2);

        // Start at root
        const { result } = renderHook(() => useGameEngine());

        act(() => { result.current.handleNextMove(); });
        expect(mockSetCurrentNode).toHaveBeenCalledWith(n1);

        // Mock being at n1
        (useGameContext as jest.Mock).mockReturnValue({
            rootNode: mockRootNode,
            currentNode: n1,
            setCurrentNode: mockSetCurrentNode,
            scrubbingNode: null,
            analysisMode: 'winrate',
            dispatchGameAction: jest.fn(),
        });

        const result2 = renderHook(() => useGameEngine()).result;
        act(() => { result2.current.handlePrevMove(); });
        expect(mockSetCurrentNode).toHaveBeenCalledWith(mockRootNode);
    });

    it('navigates fast (prev10, next10, start, end)', () => {
        // Create chain: root -> n1 -> n2 ...
        let curr: any = mockRootNode;
        for (let i = 1; i <= 15; i++) {
            const n = makeNode(i, curr);
            curr.children.push(n);
            curr = n;
        }

        (useGameContext as jest.Mock).mockReturnValue({
            rootNode: mockRootNode,
            currentNode: mockRootNode,
            setCurrentNode: mockSetCurrentNode,
            scrubbingNode: null,
            analysisMode: 'winrate',
            dispatchGameAction: jest.fn(),
        });

        const { result } = renderHook(() => useGameEngine());

        // Next 10
        act(() => { result.current.handleNext10(); });
        // Logic fetches children[0] 10 times.
        // We can't see internal loop state easily since we mocked context return value as CONSTANT.
        // Wait, useGameEngine reads currentNode from hook. If we don't update hook value, loop will restart at root?
        // "let targetNode = currentNode; for ... targetNode = targetNode.children..."
        // Yes, it iterates locally on the object graph.
        // So validation works if graph is linked.

        expect(mockSetCurrentNode).toHaveBeenCalled();
        // Should be node 10.
        const calledArg = mockSetCurrentNode.mock.calls[0][0];
        expect(calledArg.id).toBe(10);

        // Jump to End
        act(() => { result.current.jumpToEnd(); });
        const endArg = mockSetCurrentNode.mock.calls[1][0];
        expect(endArg.id).toBe(15);
    });

    it('scrubs to specific move index', () => {
        // Setup history logic by mocking useGameHistory behavior?
        // useGameEngine calls useGameHistory internally.
        // But we are testing useGameEngine integration.
        // useGameHistory derives from rootNode.

        const n1 = makeNode(1, mockRootNode);
        mockRootNode.children.push(n1);

        (useGameContext as jest.Mock).mockReturnValue({
            rootNode: mockRootNode,
            currentNode: n1,
            setCurrentNode: mockSetCurrentNode,
            scrubbingNode: null,
            analysisMode: 'winrate',
            dispatchGameAction: jest.fn(),
        });

        const { result } = renderHook(() => useGameEngine());

        // Act: Scrub (preview)
        act(() => { result.current.handleScrub(0); }); // Index 0 is typically root? History includes root?
        // gameHistoryData.moveNodes usually has root at 0 if MoveNode? No, strictly moves.
        // Let's assume index maps to valid history item.
        // Scrubbing sets internal state, doesn't call setCurrentNode.
        expect(result.current.activeNode).toBeDefined();

        // Act: Select (commit)
        act(() => { result.current.handleSelectMove(0); });
        expect(mockSetCurrentNode).toHaveBeenCalled();
    });

    it('exports SGF handles success and failure', async () => {
        const { result } = renderHook(() => useGameEngine());

        (saveGame.exportSgfFile as jest.Mock).mockResolvedValue({ success: true });
        await act(async () => { await result.current.handleExportSgf(); });
        expect(saveGame.exportSgfFile).toHaveBeenCalled();

        (saveGame.exportSgfFile as jest.Mock).mockResolvedValue({ success: false, error: 'Fail' });
        await act(async () => { await result.current.handleExportSgf(); });
        expect(mockShowError).toHaveBeenCalled();
        expect(mockShowError.mock.calls[0][0]).toContain('Fail');
    });

    it('toggles analysis mode', () => {
        const mockDispatch = jest.fn();
        (useGameContext as jest.Mock).mockReturnValue({
            rootNode: mockRootNode,
            currentNode: mockRootNode,
            setCurrentNode: mockSetCurrentNode,
            scrubbingNode: null,
            analysisMode: 'winrate',
            dispatchGameAction: mockDispatch,
        });

        const { result } = renderHook(() => useGameEngine());
        expect(result.current.analysisMode).toBe('winrate'); // Initial from mock
        act(() => { result.current.handleToggleAnalysisMode(); });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ANALYSIS_MODE' });
    });
});
