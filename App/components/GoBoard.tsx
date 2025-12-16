
import React, { useState } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';
import { Move } from '../lib/types';
import { BOARD_SIZE, BOARD_PADDING } from '../constants/game';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRenderBudget } from '@/hooks/useRenderBudget';
import { BoardGrid } from './BoardGrid';
import { GoStone } from './GoStone';

type GoBoardProps = {
  board: number[][];
  onCellPress: (row: number, col: number) => void;
  ghostStones?: Move[];
  mode: 'winrate' | 'score';
  displayMode?: 'delta' | 'absolute';
};

export const GoBoard = ({ board, onCellPress, ghostStones, mode, displayMode = 'absolute' }: GoBoardProps) => {
  // Performance monitoring - logs warnings in dev mode
  const { measureRender } = useRenderBudget('GoBoard');
  measureRender();

  const [boardWidth, setBoardWidth] = useState(0);
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme].goBoard;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setBoardWidth(width);
  };

  // Calculate dimensions based on available width
  const availableWidth = boardWidth - (BOARD_PADDING * 2);
  const cellSize = availableWidth > 0 ? availableWidth / BOARD_SIZE : 0;
  const boardDimension = cellSize * (BOARD_SIZE - 1);

  const renderStones = () => {
    // Defensive check: ensure board exists and has valid structure
    if (cellSize === 0 || !board || !Array.isArray(board)) return null;

    const elements: React.ReactNode[] = [];
    const ghostStoneMap = new Map<string, Move>();
    if (ghostStones) {
      for (const ghost of ghostStones) {
        ghostStoneMap.set(`${ghost.row}-${ghost.col}`, ghost);
      }
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      // Defensive check: ensure row exists
      if (!board[row] || !Array.isArray(board[row])) continue;

      for (let col = 0; col < BOARD_SIZE; col++) {
        const key = `${row}-${col}`;
        const ghost = ghostStoneMap.get(key);
        // Access via checked row - board[row] was already checked above
        const rowData = board[row];
        const stonePlayer = rowData?.[col] ?? 0;

        elements.push(
          <GoStone
            key={`cell-${key}`}
            row={row}
            col={col}
            cellSize={cellSize}
            stonePlayer={stonePlayer}
            ghost={ghost}
            onPress={onCellPress}
            colors={colors}
            mode={mode}
            displayMode={displayMode}
          />
        );
      }
    }
    return elements;
  };

  return (
    <View testID="go-board" style={[styles.boardContainer, { backgroundColor: colors.background }]} onLayout={onLayout}>
      {/* We need a container for the grid that is centered and has the correct aspect ratio */}
      {boardWidth > 0 && (
        <View style={[
          styles.gridContainer,
          {
            width: boardDimension,
            height: boardDimension,
          }
        ]}>
          <BoardGrid
            cellSize={cellSize}
            boardDimension={boardDimension}
            lineColor={colors.line}
            coordTextColor={colors.coordText}
          />
          {renderStones()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  boardContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gridContainer: {
    marginTop: BOARD_PADDING,
    marginLeft: BOARD_PADDING,
    marginBottom: BOARD_PADDING,
    marginRight: BOARD_PADDING,
  },
});
