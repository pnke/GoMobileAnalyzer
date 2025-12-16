import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ModernButton } from './ModernButton';
import { useTranslation } from 'react-i18next';
import { useGameContext } from '@game/context/GameContext';
import { isMoveNode } from '@/lib/types';

type ActionControlsProps = {
  onLoad: () => void;
  onSave: () => void;
  onToggleAnalysis: () => void;
  onToggleScoring: () => void;
  isScoringMode: boolean;
};

export const ActionControls = ({ onLoad, onSave, onToggleAnalysis, onToggleScoring, isScoringMode }: ActionControlsProps) => {
  const { t } = useTranslation();
  const { currentNode, promoteVariation } = useGameContext();

  const canPromote = isMoveNode(currentNode) &&
    currentNode.parent &&
    currentNode.parent.children.findIndex(c => c.id === currentNode.id) > 0;

  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <ModernButton title={t('controls.load')} onPress={onLoad} style={styles.button} />
        <ModernButton title={t('controls.save')} onPress={onSave} style={styles.button} />
      </View>
      <View style={styles.controlsRow}>
        <ModernButton title={isScoringMode ? t('controls.scoring.stop') : t('controls.scoring.start')} onPress={onToggleScoring} style={styles.button} />
        <ModernButton title={t('controls.analysisOptions')} onPress={onToggleAnalysis} style={styles.button} />
      </View>
      {canPromote && (
        <View style={styles.controlsRow}>
          <ModernButton
            title={t('actions.promoteVariation')}
            onPress={promoteVariation}
            style={[styles.button, { backgroundColor: '#e67e22' }]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1, // So that the buttons fill the row
  }
});
