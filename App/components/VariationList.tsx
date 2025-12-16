// GoAnalysisApp/components/VariationList.tsx
import React from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MoveNode } from '../lib/types';
import { formatMove } from '../lib/utils';
import { useTranslation } from 'react-i18next';

type VariationListProps = {
  variations: MoveNode[];
  onSelectVariation: (index: number) => void;
};

export const VariationList = ({ variations, onSelectVariation }: VariationListProps) => {
  const { t } = useTranslation();

  if (!variations || variations.length === 0) {
    return null; // Do not display anything if there are no alternatives
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('variations.title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {variations.map((node, index) => (
          <View key={node.id} style={styles.buttonContainer}>
            <Button
              title={formatMove(node.move)}

              onPress={() => onSelectVariation(index)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8, width: '95%', marginVertical: 5 },
  title: { fontWeight: 'bold', marginBottom: 5 },
  buttonContainer: { marginRight: 10 },
});
