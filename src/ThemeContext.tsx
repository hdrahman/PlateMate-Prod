import React, { createContext, useState, ReactNode } from 'react';

interface ThemeContextProps {
    isDarkTheme: boolean;
    toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
    isDarkTheme: false,
    toggleTheme: () => { },
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const toggleTheme = () => setIsDarkTheme(!isDarkTheme);
    return (
        <ThemeContext.Provider value={{ isDarkTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
