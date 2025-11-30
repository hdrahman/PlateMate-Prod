import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { Theme, lightTheme, darkTheme } from './styles/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextProps {
    isDarkTheme: boolean;
    toggleTheme: () => void;
    theme: Theme;
}

export const ThemeContext = createContext<ThemeContextProps>({
    isDarkTheme: true, // default set to dark
    toggleTheme: () => { },
    theme: darkTheme,
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isDarkTheme, setIsDarkTheme] = useState(true);

    useEffect(() => {
        // Load saved theme preference
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('theme');
                if (savedTheme !== null) {
                    setIsDarkTheme(savedTheme === 'dark');
                }
            } catch (error) {
                console.error('Failed to load theme preference:', error);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newThemeValue = !isDarkTheme;
        setIsDarkTheme(newThemeValue);
        try {
            await AsyncStorage.setItem('theme', newThemeValue ? 'dark' : 'light');
        } catch (error) {
            console.error('Failed to save theme preference:', error);
        }
    };

    const theme = isDarkTheme ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ isDarkTheme, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    );
};
