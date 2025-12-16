// GoAnalysisApp/components/ExportButton.tsx
// Button component for exporting SGF files

import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type ExportButtonProps = {
    onExport: () => Promise<void>;
    isExporting?: boolean;
    testID?: string;
};

export const ExportButton: React.FC<ExportButtonProps> = ({
    onExport,
    isExporting = false,
    testID = 'export-button',
}) => {
    const { t } = useTranslation();

    const handlePress = async () => {
        if (isExporting) return;
        await onExport();
    };

    return (
        <TouchableOpacity
            testID={testID}
            style={[styles.button, isExporting && styles.buttonDisabled]}
            onPress={handlePress}
            disabled={isExporting}
        >
            {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
            ) : (
                <Ionicons name="share-outline" size={20} color="#fff" />
            )}
            <Text style={styles.text}>
                {isExporting ? t('export.exporting') : t('export.button')}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4a90d9',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
