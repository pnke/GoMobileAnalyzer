import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';



import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

type ModernButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export const ModernButton = ({ title, onPress, disabled, style, textStyle, testID }: ModernButtonProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: colors.buttonBackground },
        disabled && styles.disabledButton,
        style
      ]}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[styles.text, { color: colors.buttonText }, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  disabledButton: {
    opacity: 0.6,
  },
  text: {
    fontWeight: '600',
    fontSize: 16,
  },
});
