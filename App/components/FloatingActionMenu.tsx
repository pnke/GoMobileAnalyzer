import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, TouchableWithoutFeedback } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { MINI_FAB_SIZE } from '../constants/game';

type FloatingActionMenuProps = {
    onLoad: () => void;
    onSave: () => void;
    onExport: () => void;
    onToggleAnalysis: () => void;
};

const FAB_SIZE = 56;
const SPACING = 20; // Increased for better touch separation
const OFFSET = 16;

export const FloatingActionMenu = ({ onLoad, onSave, onExport, onToggleAnalysis }: FloatingActionMenuProps) => {
    const [expanded, setExpanded] = useState(false);
    const [menuReady, setMenuReady] = useState(false);
    const animation = useRef(new Animated.Value(0)).current;
    const colorScheme = useColorScheme() ?? 'light';

    const toggleMenu = () => {
        const toValue = expanded ? 0 : 1;

        if (expanded) {
            setMenuReady(false);
        }

        Animated.spring(animation, {
            toValue,
            friction: 5,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished && !expanded) {
                // Logic: if we opened (!expanded when called), now we are open.
                setMenuReady(true);
            }
        });

        setExpanded(!expanded);
    };

    const getStyle = (index: number) => {
        const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -((index + 1) * (MINI_FAB_SIZE + SPACING))],
        });

        const scale = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
        });

        return {
            transform: [{ translateY }, { scale }],
            opacity: animation,
        };
    };

    const mainIconName = expanded ? 'xmark' : 'line.3.horizontal';
    const backgroundColor = Colors[colorScheme].tint;
    const iconColor = colorScheme === 'dark' ? '#11181C' : '#FFFFFF';

    const actions = [
        { icon: 'folder', onPress: onLoad, label: 'Load' },
        { icon: 'square.and.arrow.down', onPress: onSave, label: 'Save' },
        { icon: 'square.and.arrow.up', onPress: onExport, label: 'Export' },
        { icon: 'chart.bar', onPress: onToggleAnalysis, label: 'Analysis' },
    ];

    return (
        <>
            {expanded && (
                <TouchableWithoutFeedback onPress={() => { if (menuReady) toggleMenu(); }}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
            )}
            <View style={styles.container} pointerEvents="box-none">

                {/* Mini FABs */}
                {actions.map((action, index) => (
                    <Animated.View key={index} style={[styles.miniFabContainer, getStyle(index)]}>
                        <TouchableOpacity
                            style={[
                                styles.miniFab,
                                { backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].icon }
                            ]}
                            onPress={() => {
                                toggleMenu();
                                action.onPress();
                            }}>
                            <IconSymbol name={action.icon as any} size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </Animated.View>
                ))}

                {/* Main FAB */}
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor }]}
                    onPress={toggleMenu}
                    activeOpacity={0.8}>
                    <IconSymbol name={mainIconName} size={28} color={iconColor} />
                </TouchableOpacity>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: OFFSET,
        right: OFFSET,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 998,
    },
    fab: {
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    miniFabContainer: {
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniFab: {
        width: MINI_FAB_SIZE,
        height: MINI_FAB_SIZE,
        borderRadius: MINI_FAB_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
    },
});
