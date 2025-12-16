import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ThemedText } from './ThemedText'; // Adjust path as needed
import { IconSymbol } from './ui/IconSymbol'; // Adjust path
import { Colors } from '../constants/Colors'; // Adjust path
import { useColorScheme } from '../hooks/useColorScheme'; // Adjust path

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CollapsibleSectionProps = {
    title: string;
    children: React.ReactNode;
    initialCollapsed?: boolean;
};

export const CollapsibleSection = ({ title, children, initialCollapsed = true }: CollapsibleSectionProps) => {
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const colorScheme = useColorScheme() ?? 'light';
    const iconColor = Colors[colorScheme].icon;

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(!collapsed);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={toggle} style={styles.header}>
                <ThemedText type="subtitle">{title}</ThemedText>
                <IconSymbol
                    name={collapsed ? 'chevron.right' : 'chevron.down'}
                    size={24}
                    color={iconColor}
                />
            </TouchableOpacity>
            {!collapsed && <View style={styles.content}>{children}</View>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 10,
        backgroundColor: 'rgba(150, 150, 150, 0.1)', // Slight background for grouping
        borderRadius: 8,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'transparent',
    },
    content: {
        padding: 15,
        paddingTop: 0,
    },
});
