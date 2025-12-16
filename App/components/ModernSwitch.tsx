import React from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';



import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';

type ModernSwitchProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export const ModernSwitch = ({ label, value, onValueChange }: ModernSwitchProps) => {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.secondaryBackground }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Switch
        trackColor={{ false: "#767577", true: colors.tint }}
        thumbColor={"#f4f3f4"}
        ios_backgroundColor="#3e3e3e"
        onValueChange={onValueChange}
        value={value}
        style={Platform.OS === 'ios' ? styles.switchIOS : {}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 0,
    marginTop: 10,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  switchIOS: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }]
  }
});
