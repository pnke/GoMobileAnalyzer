import React, { useState, useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { ModernButton } from '@/components/ModernButton';
import { useTranslation } from 'react-i18next';
import { useGameContext } from '@game/context/GameContext';
import { isMoveNode, MoveNode, RootNode } from '@/lib/types';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type AnalysisSettingsProps = {
  onStartAnalysis: (params: { steps: number, startTurn?: number, endTurn?: number }) => void;
};

type AnalyzeMode = 'all' | 'current' | 'range';

export const AnalysisSettings = ({ onStartAnalysis }: AnalysisSettingsProps) => {
  const { t } = useTranslation();
  const { currentNode, analysisProgress, isAnalyzing } = useGameContext();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [steps, setSteps] = useState(1000);
  const [mode, setMode] = useState<AnalyzeMode>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const currentDepth = useMemo(() => {
    let depth = 0;
    let curr = currentNode;
    while (isMoveNode(curr)) {
      depth++;
      curr = curr.parent as MoveNode | RootNode;
    }
    return depth;
  }, [currentNode]);

  const handleStart = () => {
    let startTurn: number | undefined;
    let endTurn: number | undefined;

    if (mode === 'current') {
      startTurn = currentDepth;
      endTurn = currentDepth;
    } else if (mode === 'range') {
      startTurn = parseInt(customStart) || undefined;
      endTurn = parseInt(customEnd) || undefined;
    }

    onStartAnalysis({ steps, startTurn, endTurn });
  };

  const progressPercent = analysisProgress.total > 0
    ? (analysisProgress.current / analysisProgress.total) * 100
    : 0;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.header}>{t('actions.analysisSettings')}</ThemedText>

      {/* Progress Bar */}
      {analysisProgress.isStreaming && (
        <View style={styles.progressContainer}>
          <ThemedText style={styles.progressText}>
            {t('analysis.progress', { current: analysisProgress.current, total: analysisProgress.total })}
          </ThemedText>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      {/* Analysis Depth */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{t('settings.engineSettings')}</ThemedText>
        <View style={styles.settingRow}>
          <ThemedText style={styles.label}>{t('settings.analysisDepth')}: {steps.toLocaleString('de-DE')}</ThemedText>
          <Slider
            style={styles.slider}
            minimumValue={100}
            maximumValue={10000}
            step={100}
            value={steps}
            onValueChange={setSteps}
            minimumTrackTintColor={colors.tint}
            maximumTrackTintColor={colors.icon}
            thumbTintColor={colors.tint}
            disabled={isAnalyzing}
          />
        </View>
      </View>

      {/* Analysis Scope */}
      <View style={styles.modeContainer}>
        <ThemedText style={styles.subHeader}>{t('settings.analysisScope')}</ThemedText>
        <View style={styles.modeSelector}>
          <ModernButton
            title={t('analysis.scope.all')}
            onPress={() => setMode('all')}
            disabled={isAnalyzing}
            style={[styles.modeButton, { backgroundColor: mode === 'all' ? colors.primaryAction : colors.secondaryBackground }]}
            textStyle={{ color: mode === 'all' ? '#ffffff' : colors.text }}
          />
          <ModernButton
            title={`${t('analysis.scope.current')} (${currentDepth})`}
            onPress={() => setMode('current')}
            disabled={isAnalyzing}
            style={[styles.modeButton, { backgroundColor: mode === 'current' ? colors.primaryAction : colors.secondaryBackground }]}
            textStyle={{ color: mode === 'current' ? '#ffffff' : colors.text }}
          />
          <ModernButton
            title={t('analysis.scope.range')}
            onPress={() => setMode('range')}
            disabled={isAnalyzing}
            style={[styles.modeButton, { backgroundColor: mode === 'range' ? colors.primaryAction : colors.secondaryBackground }]}
            textStyle={{ color: mode === 'range' ? '#ffffff' : colors.text }}
          />
        </View>

        {mode === 'range' && (
          <View style={styles.rangeInputs}>
            <View style={styles.inputGroup}>
              <ThemedText>{t('analysis.scope.start')}:</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                keyboardType="numeric"
                value={customStart}
                onChangeText={setCustomStart}
                placeholder="0"
                placeholderTextColor={colors.icon}
                editable={!isAnalyzing}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText>{t('analysis.scope.end')}:</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
                keyboardType="numeric"
                value={customEnd}
                onChangeText={setCustomEnd}
                placeholder={`${currentDepth}`}
                placeholderTextColor={colors.icon}
                editable={!isAnalyzing}
              />
            </View>
          </View>
        )}
      </View>

      <ModernButton
        title={isAnalyzing ? `${t('settings.analyzing')}...` : t('settings.startAnalysis')}
        onPress={handleStart}
        style={{
          marginTop: 20,
          width: '100%',
          backgroundColor: isAnalyzing ? colors.icon : colors.primaryAction
        }}
        disabled={isAnalyzing}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 20,
    borderRadius: 12,
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    marginBottom: 15,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  subHeader: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  settingRow: {
    marginBottom: 15,
    width: '100%'
  },
  label: {
    fontSize: 14,
    marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  modeContainer: {
    width: '100%',
  },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeText: {
    fontSize: 13,
  },
  rangeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14
  },
  progressContainer: {
    marginBottom: 15,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  progressText: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
    textAlign: 'center'
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196f3',
    borderRadius: 3,
  },
});
