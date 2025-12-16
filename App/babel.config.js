module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      // Sagt Babel, wie es React Native und TypeScript verstehen soll
      'babel-preset-expo',
    ],
    plugins: [
      // Sagt Babel, wie es die Expo Router-Dateien (wie _layout) verstehen soll
      'react-native-reanimated/plugin',
    ]
  };
};
