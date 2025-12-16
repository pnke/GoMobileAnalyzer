import { useColorScheme as useNativeColorScheme } from 'react-native';
import { useSettingsContext } from '@settings/context/SettingsContext';

/**
 * Custom hook to get the effective color scheme based on user settings.
 * If config is 'system', it returns native scheme.
 * Otherwise returns 'light' or 'dark'.
 */
export function useColorScheme() {
    const { themeMode } = useSettingsContext();
    const systemScheme = useNativeColorScheme();

    if (themeMode === 'system') {
        return systemScheme;
    }

    return themeMode;
}
