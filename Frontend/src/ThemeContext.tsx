import React, { createContext, useContext, ReactNode } from 'react';
import THEME from './styles/theme';

interface ThemeContextProps {
    theme: typeof THEME;
    isDarkTheme: boolean; // Always true for monochromatic theme
}

const ThemeContext = createContext<ThemeContextProps>({
    theme: THEME,
    isDarkTheme: true,
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    // PlateMate uses a universal minimalist dark theme
    // No toggle needed - consistent across the app
    return (
        <ThemeContext.Provider value={{ theme: THEME, isDarkTheme: true }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Custom hook to use theme
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

// Legacy export for backward compatibility
export { ThemeContext };
