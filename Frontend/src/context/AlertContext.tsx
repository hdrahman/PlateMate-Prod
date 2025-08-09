import React, { createContext, useContext, useState, ReactNode } from 'react';
import ElegantAlert from '../components/ElegantAlert';

interface AlertOptions {
    title: string;
    message: string;
    type?: 'premium' | 'rate_limit' | 'info' | 'success' | 'warning' | 'error';
    icon?: string;
    primaryButtonText?: string;
    secondaryButtonText?: string;
    onPrimaryPress?: () => void;
    onSecondaryPress?: () => void;
    showCloseButton?: boolean;
    autoClose?: number;
}

interface AlertContextType {
    showAlert: (options: AlertOptions) => void;
    showPremiumAlert: (options: {
        title: string;
        message: string;
        onUpgrade?: () => void;
        feature?: string;
    }) => void;
    showRateLimitAlert: (options: {
        title: string;
        message: string;
        onUpgrade?: () => void;
        limit?: number;
        timeRemaining?: string;
    }) => void;
    showSuccessAlert: (options: {
        title: string;
        message: string;
        autoClose?: number;
    }) => void;
    showErrorAlert: (options: {
        title: string;
        message: string;
        onRetry?: () => void;
    }) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertOptions, setAlertOptions] = useState<AlertOptions>({
        title: '',
        message: '',
    });

    const showAlert = (options: AlertOptions) => {
        setAlertOptions(options);
        setAlertVisible(true);
    };

    const hideAlert = () => {
        setAlertVisible(false);
    };

    const showPremiumAlert = ({
        title,
        message,
        onUpgrade,
        feature,
    }: {
        title: string;
        message: string;
        onUpgrade?: () => void;
        feature?: string;
    }) => {
        showAlert({
            title,
            message,
            type: 'premium',
            primaryButtonText: 'Upgrade Now',
            secondaryButtonText: 'Maybe Later',
            onPrimaryPress: onUpgrade,
            icon: 'diamond-outline',
        });
    };

    const showRateLimitAlert = ({
        title,
        message,
        onUpgrade,
        limit,
        timeRemaining,
    }: {
        title: string;
        message: string;
        onUpgrade?: () => void;
        limit?: number;
        timeRemaining?: string;
    }) => {
        let enhancedMessage = message;
        
        if (limit) {
            enhancedMessage += `\n\nDaily limit: ${limit} uploads`;
        }
        
        if (timeRemaining) {
            enhancedMessage += `\nResets in: ${timeRemaining}`;
        }

        showAlert({
            title,
            message: enhancedMessage,
            type: 'rate_limit',
            primaryButtonText: 'Upgrade for Unlimited',
            secondaryButtonText: 'Wait Until Reset',
            onPrimaryPress: onUpgrade,
            icon: 'time-outline',
        });
    };

    const showSuccessAlert = ({
        title,
        message,
        autoClose = 3000,
    }: {
        title: string;
        message: string;
        autoClose?: number;
    }) => {
        showAlert({
            title,
            message,
            type: 'success',
            primaryButtonText: 'Great!',
            autoClose,
            showCloseButton: false,
            icon: 'checkmark-circle-outline',
        });
    };

    const showErrorAlert = ({
        title,
        message,
        onRetry,
    }: {
        title: string;
        message: string;
        onRetry?: () => void;
    }) => {
        showAlert({
            title,
            message,
            type: 'error',
            primaryButtonText: onRetry ? 'Try Again' : 'OK',
            secondaryButtonText: onRetry ? 'Cancel' : undefined,
            onPrimaryPress: onRetry,
            icon: 'alert-circle-outline',
        });
    };

    const contextValue: AlertContextType = {
        showAlert,
        showPremiumAlert,
        showRateLimitAlert,
        showSuccessAlert,
        showErrorAlert,
        hideAlert,
    };

    return (
        <AlertContext.Provider value={contextValue}>
            {children}
            <ElegantAlert
                visible={alertVisible}
                onClose={hideAlert}
                title={alertOptions.title}
                message={alertOptions.message}
                type={alertOptions.type}
                icon={alertOptions.icon}
                primaryButtonText={alertOptions.primaryButtonText}
                secondaryButtonText={alertOptions.secondaryButtonText}
                onPrimaryPress={alertOptions.onPrimaryPress}
                onSecondaryPress={alertOptions.onSecondaryPress}
                showCloseButton={alertOptions.showCloseButton}
                autoClose={alertOptions.autoClose}
            />
        </AlertContext.Provider>
    );
};

export const useAlert = (): AlertContextType => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

// Convenience hooks for specific alert types
export const usePremiumAlert = () => {
    const { showPremiumAlert } = useAlert();
    return showPremiumAlert;
};

export const useRateLimitAlert = () => {
    const { showRateLimitAlert } = useAlert();
    return showRateLimitAlert;
};

export const useSuccessAlert = () => {
    const { showSuccessAlert } = useAlert();
    return showSuccessAlert;
};

export const useErrorAlert = () => {
    const { showErrorAlert } = useAlert();
    return showErrorAlert;
};