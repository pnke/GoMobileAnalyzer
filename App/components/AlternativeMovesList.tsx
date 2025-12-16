// GoAnalysisApp/components/AlternativeMovesList.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AIAlternative } from '../lib/types';
import { useTranslation } from 'react-i18next';

type AlternativeMovesListProps = {
  alternatives?: AIAlternative[];
  mode: 'winrate' | 'score';
};

export const AlternativeMovesList = ({ alternatives, mode }: AlternativeMovesListProps) => {
  const { t } = useTranslation();

  if (!alternatives || alternatives.length === 0) {
    return null;
  }

  // Determine the unit based on the mode
  const unit = mode === 'winrate' ? '%' : ` ${t('alt.pointsUnit.score')}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('alt.title')}</Text>
      {alternatives.map((alt, index) => (
        <View key={index} style={styles.alternativeRow}>
          <Text style={styles.moveText}>{`${index + 1}. ${alt.move}`}</Text>
          <Text style={styles.winrateText}>{`${t('alt.win')}: ${alt.winrate.toFixed(1)}%`}</Text>
          <Text style={styles.pointsLostText}>
            {`(-${alt.pointsLost.toFixed(1)}${unit})`}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    width: '95%',
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  alternativeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  moveText: {
    fontSize: 14,
    fontWeight: '500',
  },
  winrateText: {
    fontSize: 14,
    color: 'green',
  },
  pointsLostText: {
    fontSize: 14,
    color: '#c0392b',
    fontStyle: 'italic',
  },
});

export default AlternativeMovesList;
