import React from 'react';
import { Modal, View, StyleSheet, Dimensions } from 'react-native';
import ScannerAnimation from './ScannerAnimation';

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
    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
            statusBarTranslucent={true}
        >
            <View style={styles.modalContainer}>
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
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
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