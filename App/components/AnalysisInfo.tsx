import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

type AnalysisInfoProps = {
  comment?: string;
};

export const AnalysisInfo = ({ comment }: AnalysisInfoProps) => {
  const { t } = useTranslation();

  if (!comment) {
    return null; // Do not display anything if no comment is present
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('analysis.katago')}</Text>
      <Text style={styles.commentText}>{comment}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#e6f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#91d5ff',
    width: '95%',
    marginVertical: 5,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#0050b3',
  },
  commentText: {
    fontSize: 14,
  },
});
