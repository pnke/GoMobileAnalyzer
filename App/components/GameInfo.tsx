import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from './ThemedText';

type GameInfoProps = {
  moveCount: number;
  totalMoves: number;
  capturedByBlack: number;
  capturedByWhite: number;
};

export const GameInfo = ({ moveCount, totalMoves, capturedByBlack, capturedByWhite }: GameInfoProps) => {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.captureInfo}>
        <ThemedText type="defaultSemiBold">{t('game.captured.black')}: {capturedByWhite}</ThemedText>
        <ThemedText type="defaultSemiBold">{t('game.captured.white')}: {capturedByBlack}</ThemedText>
      </View>
      <ThemedText type="defaultSemiBold">{t('game.move')}: {moveCount} / {totalMoves}</ThemedText>
    </>
  );
};

const styles = StyleSheet.create({
  captureInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginBottom: 5,
  },
});
