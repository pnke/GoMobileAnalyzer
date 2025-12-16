import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FloatingActionMenu } from '../../components/FloatingActionMenu';
import { useGameContext } from '@game/context/GameContext';
import { saveSgfWithPicker } from '../../lib/saveGame';
import { useError } from '@game/context/ErrorContext';
import { AnalysisSettingsModal } from '../../components/AnalysisSettingsModal';

import { UnifiedMoveList } from '@analysis/components/UnifiedMoveList';
import { AnalysisInfo } from '../../components/AnalysisInfo';
import { ThemedView } from '../../components/ThemedView';
import { GameChart } from '../../components/GameChart';
import { GameInfo } from '../../components/GameInfo';
import { GoBoard } from '../../components/GoBoard';
import { NavigationControls } from '../../components/NavigationControls';

import { useSettingsContext } from '@settings/context/SettingsContext';
import { MoveNode, RootNode } from '../../lib/types';
import { useGameEngine } from '@analysis/hooks/useGameEngine';
import { useTranslation } from 'react-i18next';

function isMoveNode(
  node: MoveNode | RootNode | undefined | null
): node is MoveNode {
  return !!node && 'move' in node;
}

export default function HomeScreen() {
  const { showComments, showAlternatives, ghostStoneDisplay, alternativeMoveCount } = useSettingsContext();
  const { t } = useTranslation();

  // Action Context
  const { handleLoadSgf, handleStartAnalysis } = useGameContext();
  const { showError } = useError();
  const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);

  const {
    board,
    rootNode,
    capturedByBlack,
    capturedByWhite,
    analysisMode,
    activeNode,
    currentNode,
    analysisData,
    chartDisplayData,
    yAxisLabels,
    yRange,
    errorIndices,
    moveCount,
    totalMoves,
    currentMoveIndex,
    handleCellPress,
    handleToggleAnalysisMode,
    handleScrub,
    handleSelectMove,
    handlePrevMove,
    handleNextMove,
    handlePrev10,
    handleNext10,
    jumpToStart,
    jumpToEnd,
    handleExportSgf
  } = useGameEngine();

  const onExport = async () => {
    await handleExportSgf();
  };

  const handleSave = async () => {
    const result = await saveSgfWithPicker(rootNode);
    if (result.success) {
      showError(t('export.success'), 'success');
    } else if (result.error !== 'Permission denied') {
      showError(t('export.error') + ': ' + result.error, 'error');
    }
  };

  return (
    <ThemedView style={styles.outerContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <GameInfo moveCount={moveCount} totalMoves={totalMoves} capturedByBlack={capturedByBlack} capturedByWhite={capturedByWhite} />
        <GameChart
          data={chartDisplayData}
          title={analysisMode === 'winrate' ? t('chart.title.winrate') : t('chart.title.score')}
          onTitlePress={handleToggleAnalysisMode}
          yRange={yRange}
          yAxisLabels={yAxisLabels}
          onSelectMove={handleSelectMove}
          onScrub={handleScrub}
          currentMoveIndex={currentMoveIndex}
          errorIndices={errorIndices}
        />
        {showComments && <AnalysisInfo comment={isMoveNode(activeNode) ? activeNode.move.comment : undefined} />}
        <GoBoard
          board={board}
          onCellPress={handleCellPress}
          ghostStones={analysisData.ghostStones}
          mode={analysisMode}
          displayMode={ghostStoneDisplay}
        />
        <NavigationControls
          onJumpToStart={jumpToStart}
          onPrev10={handlePrev10}
          onPrevMove={handlePrevMove}
          onNextMove={() => handleNextMove(0)}
          onNext10={handleNext10}
          onJumpToEnd={jumpToEnd}
          isAtStart={!isMoveNode(currentNode)}
          isAtEnd={!currentNode.children || currentNode.children.length === 0}
        />
        {(showAlternatives || (currentNode.children && currentNode.children.length > 0)) && (
          <UnifiedMoveList
            variations={currentNode.children}
            alternatives={showAlternatives ? analysisData.alternatives : undefined}
            mode={analysisMode}
            onSelectVariation={handleNextMove}
            maxCount={alternativeMoveCount}
          />
        )}
      </ScrollView>

      <FloatingActionMenu
        onLoad={handleLoadSgf}
        onSave={handleSave}
        onExport={onExport}
        onToggleAnalysis={() => setShowAnalysisSettings(true)}
      />

      <AnalysisSettingsModal
        visible={showAnalysisSettings}
        onClose={() => setShowAnalysisSettings(false)}
        onStartAnalysis={handleStartAnalysis}
      />

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: { paddingTop: 50, paddingBottom: 50, alignItems: 'center', gap: 10 },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
