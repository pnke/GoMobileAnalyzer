import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useError } from '@game/context/ErrorContext';
import { IconSymbol } from './ui/IconSymbol';

export const ErrorToast = () => {
    const { error, clearError } = useError();
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
        if (error) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: -20,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [error, opacity, translateY]);

    if (!error) return null;

    const getBackgroundColor = () => {
        switch (error.type) {
            case 'error': return '#dc3545';
            case 'warning': return '#ffc107';
            case 'success': return '#28a745';
            case 'info': return '#17a2b8';
            default: return '#333';
        }
    };

    const getIconName = () => {
        switch (error.type) {
            case 'error': return 'exclamationmark.circle.fill';
            case 'warning': return 'exclamationmark.triangle.fill';
            case 'success': return 'checkmark.circle.fill';
            case 'info': return 'info.circle.fill';
            default: return 'info.circle.fill';
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { backgroundColor: getBackgroundColor(), opacity, transform: [{ translateY }] },
            ]}
        >
            <View style={styles.content}>
                <IconSymbol name={getIconName()} size={24} color="#fff" />
                <Text style={[styles.text, error.type === 'warning' && styles.textDark]}>{error.message}</Text>
            </View>
            <TouchableOpacity onPress={clearError} style={styles.closeButton}>
                <IconSymbol name="xmark" size={20} color={error.type === 'warning' ? '#333' : '#fff'} />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50, // Adjust based on safe area
        left: 20,
        right: 20,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    textDark: {
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
});
