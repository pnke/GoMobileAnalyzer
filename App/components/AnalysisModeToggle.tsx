// GoAnalysisApp/components/AnalysisModeToggle.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type AnalysisModeToggleProps = {
  mode: 'winrate' | 'score';
  onToggle: (mode: 'winrate' | 'score') => void;
};

export const AnalysisModeToggle = ({ mode, onToggle }: AnalysisModeToggleProps) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, mode === 'winrate' && styles.activeButton]}
        onPress={() => onToggle('winrate')}
      >
        <Text style={[styles.text, mode === 'winrate' && styles.activeText]}>{t('analysis.mode.winrate')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, mode === 'score' && styles.activeButton]}
        onPress={() => onToggle('score')}
      >
        <Text style={[styles.text, mode === 'score' && styles.activeText]}>{t('analysis.mode.score')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#dee2e6'
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: '#007bff',
  },
  text: {
    color: '#007bff',
    fontWeight: '600',
  },
  activeText: {
    color: '#fff',
  },
});
