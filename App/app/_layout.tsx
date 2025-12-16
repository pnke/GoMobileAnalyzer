// GoAnalysisApp/app/_layout.tsx
import 'react-native-reanimated';
import React from 'react';
import '../i18n/i18n';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorProvider } from '@game/context/ErrorContext';
import { ErrorToast } from '../components/ErrorToast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SettingsProvider } from '@settings/context/SettingsContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ErrorProvider>
          <SettingsProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <ErrorToast />
          </SettingsProvider>
        </ErrorProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
