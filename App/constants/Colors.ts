/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    goBoard: {
      background: '#D1B071',
      line: '#000000',
      coordText: '#5c4033',
      starPoint: '#000000',
      blackStone: '#000000',
      whiteStone: '#ffffff',
      ghostBlack: '#000000',
      ghostWhite: '#ffffff',
      bestMove: '#27ae60',
      playedMove: '#2980b9',
      deltaPositive: '#e74c3c',
      deltaNegative: '#c0392b',
      deltaText: '#000000',
    },
    buttonBackground: '#0a7ea4',
    buttonText: '#ffffff',
    secondaryBackground: '#f0f0f0',
    toggleButtonChecked: '#0a7ea4',
    toggleButtonUnchecked: '#e9ecef', // Light gray
    primaryAction: '#0a7ea4', // Fixed accent color for action buttons (works in both themes)
    chartBackground: '#f8f9fa',
    chartText: '#11181C',
    chartLine: 'rgba(0, 0, 0, 0.4)',
    chartGrid: 'rgba(0, 0, 0, 0.1)',
    chartBlackArea: 'rgba(0, 0, 0, 0.1)',
    chartWhiteArea: 'rgba(255, 255, 255, 0.5)',
    deltaPositive: '#e74c3c',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    goBoard: {
      background: '#C0A060', // Slightly darker for dark mode
      line: '#1A1A1A',
      coordText: '#3E2C22',
      starPoint: '#1A1A1A',
      blackStone: '#000000',
      whiteStone: '#E0E0E0', // Slightly off-white for better contrast
      ghostBlack: '#000000',
      ghostWhite: '#E0E0E0',
      bestMove: '#2ecc71', // Brighter green
      playedMove: '#3498db', // Brighter blue
      deltaPositive: '#ff6b6b', // Brighter red
      deltaNegative: '#e74c3c',
      deltaText: '#000000',
    },
    buttonBackground: '#495057',
    buttonText: '#ffffff',
    secondaryBackground: '#2b2d31',
    toggleButtonChecked: '#0a7ea4', // Tint color
    toggleButtonUnchecked: '#2b2d31', // Secondary background
    primaryAction: '#0a7ea4', // Fixed accent color for action buttons (works in both themes)
    chartBackground: '#2b2d31',
    chartText: '#ECEDEE',
    chartLine: 'rgba(255, 255, 255, 0.4)',
    chartGrid: 'rgba(255, 255, 255, 0.1)',
    chartBlackArea: 'rgba(0, 0, 0, 0.3)',
    chartWhiteArea: 'rgba(255, 255, 255, 0.1)',
    deltaPositive: '#ff6b6b',
  },
};
