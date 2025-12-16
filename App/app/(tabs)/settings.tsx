import React from 'react';
import { StyleSheet, View, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

import { ModernSwitch } from '@/components/ModernSwitch';
import { ModernButton } from '@/components/ModernButton';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettingsContext } from '@settings/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CollapsibleSection } from '@/components/CollapsibleSection';
export default function SettingsScreen() {
  const {
    showComments,
    setShowComments,
    showAlternatives,
    setShowAlternatives,
    backendConfig,
    setBackendConfig,
    language,
    setLanguage,
    ghostStoneDisplay,
    setGhostStoneDisplay,
    themeMode,
    setThemeMode,
    winrateThreshold, setWinrateThreshold,
    scoreThreshold, setScoreThreshold,
    ghostStoneCount, setGhostStoneCount,
    alternativeMoveCount, setAlternativeMoveCount
  } = useSettingsContext();
  const { t } = useTranslation();
  const bottom = useBottomTabOverflow();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme]; // Add this
  const textColor = Colors[colorScheme].text;
  const placeholderColor = Colors[colorScheme].icon;
  const inputBorderColor = Colors[colorScheme].icon;

  const [mode, setMode] = React.useState(backendConfig.mode);
  const [domainUrl, setDomainUrl] = React.useState(backendConfig.domainUrl);
  const [domainApiKey, setDomainApiKey] = React.useState(backendConfig.domainApiKey || '');
  const [runpodEndpoint, setRunpodEndpoint] = React.useState(backendConfig.runpodEndpoint);
  const [runpodBearer, setRunpodBearer] = React.useState(backendConfig.runpodBearer || '');
  const [runpodWorkerKey, setRunpodWorkerKey] = React.useState(backendConfig.runpodWorkerKey || '');

  const saveConfig = () => {
    setBackendConfig({
      mode,
      domainUrl,
      domainApiKey,
      runpodEndpoint,
      runpodBearer,
      runpodWorkerKey,
    });
  };

  // Helper for button styles - selected = blue with white text, unselected = secondary bg with theme text
  const getButtonStyle = (isSelected: boolean) => [
    styles.modeBtn,
    { backgroundColor: isSelected ? colors.primaryAction : colors.secondaryBackground }
  ];

  const getTextStyle = (isSelected: boolean) => ({
    color: isSelected ? '#ffffff' : colors.text
  });


  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={100}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 20 }]}>
            <View style={styles.titleContainer}>
              <ThemedText type="title">{t('settings.title')}</ThemedText>
            </View>

            {/* --- Display settings --- */}
            <CollapsibleSection title={t('settings.display')} initialCollapsed={true}>
              <ThemedText style={{ marginBottom: 10 }}>{t('settings.display.desc')}</ThemedText>
              <View style={styles.settingsControls}>
                <ModernSwitch
                  label={t('settings.comments')}
                  value={showComments}
                  onValueChange={setShowComments}
                />
                <ModernSwitch
                  label={t('settings.alternatives')}
                  value={showAlternatives}
                  onValueChange={setShowAlternatives}
                />
              </View>

              {/* Theme Selection */}
              <ThemedText style={{ marginTop: 10 }}>{t('settings.theme')}</ThemedText>
              <View style={styles.modeRow}>
                <ModernButton
                  title={t('settings.theme.light')}
                  onPress={() => setThemeMode('light')}
                  style={getButtonStyle(themeMode === 'light')}
                  textStyle={getTextStyle(themeMode === 'light')}
                />
                <ModernButton
                  title={t('settings.theme.dark')}
                  onPress={() => setThemeMode('dark')}
                  style={getButtonStyle(themeMode === 'dark')}
                  textStyle={getTextStyle(themeMode === 'dark')}
                />
                <ModernButton
                  title={t('settings.theme.system')}
                  onPress={() => setThemeMode('system')}
                  style={getButtonStyle(themeMode === 'system')}
                  textStyle={getTextStyle(themeMode === 'system')}
                />
              </View>

              {/* Ghost Stone Display Mode Toggle */}
              <ThemedText style={{ marginTop: 10 }}>{t('settings.stoneValues')}</ThemedText>
              <View style={styles.modeRow}>
                <ModernButton
                  title={t('settings.stoneValues.absolute')}
                  onPress={() => setGhostStoneDisplay('absolute')}
                  style={getButtonStyle(ghostStoneDisplay === 'absolute')}
                  textStyle={getTextStyle(ghostStoneDisplay === 'absolute')}
                />
                <ModernButton
                  title={t('settings.stoneValues.delta')}
                  onPress={() => setGhostStoneDisplay('delta')}
                  style={getButtonStyle(ghostStoneDisplay === 'delta')}
                  textStyle={getTextStyle(ghostStoneDisplay === 'delta')}
                />
              </View>

              <ThemedText style={{ marginTop: 10, marginBottom: 5 }}>{t('settings.ghostStones')}: {ghostStoneCount}</ThemedText>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={ghostStoneCount}
                onValueChange={setGhostStoneCount}
                minimumTrackTintColor={colors.tint}
                maximumTrackTintColor={colors.icon}
                thumbTintColor={colors.tint}
              />

              <ThemedText style={{ marginTop: 10, marginBottom: 5 }}>{t('settings.alternativeMoves')}: {alternativeMoveCount}</ThemedText>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0}
                maximumValue={20}
                step={1}
                value={alternativeMoveCount}
                onValueChange={setAlternativeMoveCount}
                minimumTrackTintColor={colors.tint}
                maximumTrackTintColor={colors.icon}
                thumbTintColor={colors.tint}
              />
            </CollapsibleSection>

            {/* --- Analysis Thresholds --- */}
            <CollapsibleSection title={t('settings.analysisThresholds')} initialCollapsed={true}>
              <ThemedText style={{ marginBottom: 5 }}>{t('settings.winrateMistake')}: {winrateThreshold}%</ThemedText>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={winrateThreshold}
                onValueChange={setWinrateThreshold}
                minimumTrackTintColor={colors.tint}
                maximumTrackTintColor={colors.icon}
                thumbTintColor={colors.tint}
              />

              <ThemedText style={{ marginTop: 10, marginBottom: 5 }}>{t('settings.scoreMistake')}: {scoreThreshold} {t('settings.pts')}</ThemedText>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0.5}
                maximumValue={20}
                step={0.5}
                value={scoreThreshold}
                onValueChange={setScoreThreshold}
                minimumTrackTintColor={colors.tint}
                maximumTrackTintColor={colors.icon}
                thumbTintColor={colors.tint}
              />
            </CollapsibleSection>

            {/* --- Language selection --- */}
            <CollapsibleSection title={t('language.title')} initialCollapsed={true}>
              <View style={styles.modeRow}>
                <ModernButton
                  title={t('language.english')}
                  onPress={() => setLanguage('en')}
                  style={getButtonStyle(language === 'en')}
                  textStyle={getTextStyle(language === 'en')}
                />
                <ModernButton
                  title={t('language.german')}
                  onPress={() => setLanguage('de')}
                  style={getButtonStyle(language === 'de')}
                  textStyle={getTextStyle(language === 'de')}
                />
              </View>
            </CollapsibleSection>

            {/* --- Backend configuration --- */}
            <CollapsibleSection title={t('backend.title')} initialCollapsed={true}>
              <ThemedText style={{ marginBottom: 10 }}>{t('backend.desc')}</ThemedText>
              <View style={styles.serverList}>
                <View style={styles.modeRow}>
                  <ModernButton
                    title={t('backend.mode.domain')}
                    onPress={() => setMode('domain')}
                    style={getButtonStyle(mode === 'domain')}
                    textStyle={getTextStyle(mode === 'domain')}
                  />
                  <ModernButton
                    title={t('backend.mode.runpod')}
                    onPress={() => setMode('runpod')}
                    style={getButtonStyle(mode === 'runpod')}
                    textStyle={getTextStyle(mode === 'runpod')}
                  />
                </View>

                {mode === 'domain' ? (
                  <View style={styles.formBlock}>
                    <ThemedText>{t('backend.domain.url')}</ThemedText>
                    <TextInput
                      style={[styles.input, { color: textColor, borderColor: inputBorderColor }]}
                      value={domainUrl}
                      onChangeText={setDomainUrl}
                      placeholder="https://.../analyze"
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="none"
                    />
                    <ThemedText>{t('backend.domain.key')}</ThemedText>
                    <TextInput
                      style={[styles.input, { color: textColor, borderColor: inputBorderColor }]}
                      value={domainApiKey}
                      onChangeText={setDomainApiKey}
                      placeholder="API Key"
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                  </View>
                ) : (
                  <View style={styles.formBlock}>
                    <ThemedText>{t('backend.runpod.endpoint')}</ThemedText>
                    <TextInput
                      style={[styles.input, { color: textColor, borderColor: inputBorderColor }]}
                      value={runpodEndpoint}
                      onChangeText={setRunpodEndpoint}
                      placeholder="https://api.runpod.ai/v2/.../runsync"
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="none"
                    />
                    <ThemedText>{t('backend.runpod.bearer')}</ThemedText>
                    <TextInput
                      style={[styles.input, { color: textColor, borderColor: inputBorderColor }]}
                      value={runpodBearer}
                      onChangeText={setRunpodBearer}
                      placeholder="rpa_..."
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                    <ThemedText>{t('backend.runpod.worker')}</ThemedText>
                    <TextInput
                      style={[styles.input, { color: textColor, borderColor: inputBorderColor }]}
                      value={runpodWorkerKey}
                      onChangeText={setRunpodWorkerKey}
                      placeholder="worker secret"
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                  </View>
                )}

                <ModernButton title={t('common.save')} onPress={saveConfig} style={styles.saveBtn} />
              </View>
            </CollapsibleSection>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  titleContainer: {
    gap: 8,
    marginBottom: 10,
  },
  section: {
    marginTop: 20,
    width: '100%',
    gap: 10,
  },
  settingsControls: {
    gap: 10,
  },
  serverList: {
    marginTop: 10,
    gap: 15,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 0,
    paddingVertical: 10,
  },
  formBlock: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  saveBtn: {
    marginTop: 10,
  },
  selectedText: {
    fontWeight: 'bold',
  },
});
