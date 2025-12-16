import React from 'react';
import { StyleSheet, View, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AnalysisSettings } from '@analysis/components/AnalysisSettings';
import { ModernButton } from './ModernButton';

interface AnalysisSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    onStartAnalysis: (params: any) => void;
}

export const AnalysisSettingsModal = ({ visible, onClose, onStartAnalysis }: AnalysisSettingsModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <AnalysisSettings onStartAnalysis={(params) => {
                        onStartAnalysis(params);
                        onClose();
                    }} />
                    <ModernButton
                        title={t('common.close')}
                        onPress={onClose}
                        style={{ marginTop: 10 }}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: 'transparent',
    },
});
