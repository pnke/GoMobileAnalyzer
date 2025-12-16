import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function BlurTabBarBackground() {
  const colorScheme = useColorScheme();
  return (
    <BlurView
      // Adapt to our custom theme
      tint={colorScheme === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'}
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
