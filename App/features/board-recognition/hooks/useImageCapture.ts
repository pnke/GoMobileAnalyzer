import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { CAPTURE_QUALITY } from '@/constants/game';

export const useImageCapture = () => {
    const { t } = useTranslation();
    const [imageUri, setImageUri] = useState<string | null>(null);

    const pickImage = useCallback(async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('capture.permissionDenied'), t('capture.galleryPermission'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: CAPTURE_QUALITY,
        });

        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
        }
    }, [t]);

    const takePhoto = useCallback(async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('capture.permissionDenied'), t('capture.cameraPermission'));
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: CAPTURE_QUALITY,
        });

        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
        }
    }, [t]);

    const clearImage = useCallback(() => {
        setImageUri(null);
    }, []);

    return {
        imageUri,
        pickImage,
        takePhoto,
        clearImage,
        setImageUri
    };
};
