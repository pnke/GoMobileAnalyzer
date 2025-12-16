import { Tabs } from 'expo-router'; // eslint-disable-line
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { GameProvider } from '@game/context/GameContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { GoBoardIcon } from '@/components/ui/GoBoardIcon';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <GameProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
          headerShown: false,
          tabBarShowLabel: false, // Remove text below icons
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
              // On iOS we have the BlurView, but setting a transparent background doesn't hurt
              backgroundColor: 'transparent',
            },
            default: {
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderTopColor: Colors[colorScheme ?? 'light'].icon, // Optional separator
            },
          }),
        }}>


        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.board'),
            tabBarIcon: ({ color }) => <GoBoardIcon size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="capture"
          options={{
            title: t('tabs.capture'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="camera.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="slider.horizontal.3" color={color} />,
          }}
        />
      </Tabs>
    </GameProvider>
  );
}
