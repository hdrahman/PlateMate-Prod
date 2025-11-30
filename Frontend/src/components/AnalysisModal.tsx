import React, { useContext } from 'react';
import { Modal, View, StyleSheet, Dimensions } from 'react-native';
import ScannerAnimation from './ScannerAnimation';
import { ThemeContext } from '../ThemeContext';

const { height } = Dimensions.get('window');

interface AnalysisModalProps {
    visible: boolean;
    onCancel?: () => void;
    stage: 'uploading' | 'analyzing' | 'processing';
    imageUri?: string;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({
    visible,
    onCancel,
    stage = 'analyzing',
    imageUri
}) => {
    const { theme, isDarkTheme } = useContext(ThemeContext);

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
            statusBarTranslucent={true}
        >
            <View style={[styles.modalContainer, { backgroundColor: `${theme.colors.background}E6` }]}>
                <ScannerAnimation
                    stage={stage}
                    imageUri={imageUri}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        width: '100%',
        height: height,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    }
});

export default AnalysisModal; 