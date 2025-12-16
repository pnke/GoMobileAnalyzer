import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ModernButton } from './ModernButton';

type NavigationControlsProps = {
  onJumpToStart: () => void;
  onPrev10: () => void;
  onPrevMove: () => void;
  onNextMove: () => void;
  onNext10: () => void;
  onJumpToEnd: () => void;
  isAtStart: boolean;
  isAtEnd: boolean;
};

export const NavigationControls = ({
  onJumpToStart,
  onPrev10,
  onPrevMove,
  onNextMove,
  onNext10,
  onJumpToEnd,
  isAtStart,
  isAtEnd
}: NavigationControlsProps) => (
  <View style={styles.navigationControls} accessibilityRole="toolbar" accessibilityLabel="Game navigation controls">
    <ModernButton testID="jump-start-button" title="|<<" onPress={onJumpToStart} disabled={isAtStart} />
    <ModernButton testID="prev-10-button" title="<<" onPress={onPrev10} disabled={isAtStart} />
    <ModernButton testID="prev-move-button" title="<" onPress={onPrevMove} disabled={isAtStart} />
    <ModernButton testID="next-move-button" title=">" onPress={onNextMove} disabled={isAtEnd} />
    <ModernButton testID="next-10-button" title=">>" onPress={onNext10} disabled={isAtEnd} />
    <ModernButton testID="jump-end-button" title=">>|" onPress={onJumpToEnd} disabled={isAtEnd} />
  </View>
);

const styles = StyleSheet.create({
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '95%',
    gap: 8,
  },
});
