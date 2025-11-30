export interface Theme {
    dark: boolean;
    colors: {
        background: string;
        cardBackground: string;
        text: string;
        textSecondary: string;
        primary: string;
        secondary: string;
        border: string;
        inputBackground: string;
        success: string;
        error: string;
        warning: string;
        tabBarBackground: string;
        tabBarActive: string;
        tabBarInactive: string;
        overlay: string;
        shadow: string;
    };
}

export const darkTheme: Theme = {
    dark: true,
    colors: {
        background: '#000000',
        cardBackground: '#141414',
        text: '#FFFFFF',
        textSecondary: '#AAAAAA',
        primary: '#9B00FF',
        secondary: '#BB86FC',
        border: '#2A2A2A',
        inputBackground: '#1A1A1A',
        success: '#4CAF50',
        error: '#FF453A',
        warning: '#FF9500',
        tabBarBackground: '#000000',
        tabBarActive: '#9B00FF',
        tabBarInactive: '#777777',
        overlay: 'rgba(0, 0, 0, 0.85)',
        shadow: '#000000',
    },
};

export const lightTheme: Theme = {
    dark: false,
    colors: {
        background: '#F8F7F5',
        cardBackground: '#FFFFFF',
        text: '#1A1A1A',
        textSecondary: '#6B6B6B',
        primary: '#9B00FF',
        secondary: '#7F39FB',
        border: '#E8E6E3',
        inputBackground: '#EFEEEC',
        success: '#34C759',
        error: '#FF3B30',
        warning: '#FF9500',
        tabBarBackground: '#F8F7F5',
        tabBarActive: '#9B00FF',
        tabBarInactive: '#8E8E93',
        overlay: 'rgba(0, 0, 0, 0.4)',
        shadow: 'rgba(0, 0, 0, 0.1)',
    },
};
