// Theme system for PlateMate
// Semantic color tokens that adapt to light/dark mode

export interface Theme {
    dark: boolean;
    colors: {
        // Backgrounds & Surfaces
        background: string;
        surface: string;              // Elevated surface (modals, popups)
        cardBackground: string;
        inputBackground: string;
        
        // Text hierarchy
        text: string;
        textSecondary: string;
        textMuted: string;            // Tertiary/disabled text
        
        // Brand & Accents
        primary: string;
        primaryVariant: string;       // Lighter/darker variant for hover/pressed states
        secondary: string;
        accent: string;               // Neon accent color
        
        // Icons
        iconPrimary: string;
        iconSecondary: string;
        
        // Borders & Dividers
        border: string;
        borderStrong: string;         // More visible borders
        
        // Status colors
        success: string;
        error: string;
        warning: string;
        
        // Navigation
        tabBarBackground: string;
        tabBarActive: string;
        tabBarInactive: string;
        headerBackground: string;
        
        // Chart/Ring colors (brand-safe for both themes)
        ringBackground: string;
        chartCarbs: string;
        chartProtein: string;
        chartFat: string;
        chartCalories: string;
        chartSteps: string;
        
        // Misc
        overlay: string;
        shadow: string;
        
        // Gradient presets (object form)
        gradient: {
            primary: readonly string[];
            accent: readonly string[];
            neon: readonly string[];
            cardBorder: readonly string[];
        };
        
        // Individual gradient arrays (for direct use in LinearGradient)
        gradientNeonBlue: readonly string[];
        gradientNeonPink: readonly string[];
        gradientNeonGreen: readonly string[];
        gradientNeonPurple: readonly string[];
        gradientNeonOrange: readonly string[];
        gradientNeonCyan: readonly string[];
        gradientNeonRed: readonly string[];
        gradientNeonYellow: readonly string[];
    };
}

export const darkTheme: Theme = {
    dark: true,
    colors: {
        // Backgrounds & Surfaces - Pure black for OLED
        background: '#000000',
        surface: '#1C1C1E',
        cardBackground: '#141414',
        inputBackground: '#1A1A1A',
        
        // Text hierarchy - High contrast on dark
        text: '#FFFFFF',
        textSecondary: '#AAAAAA',
        textMuted: '#666666',
        
        // Brand & Accents - Neon purple primary
        primary: '#9B00FF',
        primaryVariant: '#BB86FC',
        secondary: '#5A60EA',
        accent: '#FF00F5',
        
        // Icons
        iconPrimary: '#FFFFFF',
        iconSecondary: '#AAAAAA',
        
        // Borders & Dividers
        border: '#2A2A2A',
        borderStrong: '#3A3A3A',
        
        // Status colors - Vivid on dark
        success: '#4CAF50',
        error: '#FF453A',
        warning: '#FF9500',
        
        // Navigation
        tabBarBackground: '#000000',
        tabBarActive: '#FF00F5',
        tabBarInactive: '#7B1FA2',
        headerBackground: '#000000',
        
        // Chart/Ring colors - Neon palette
        ringBackground: '#1A1A1A',
        chartCarbs: '#0084FF',
        chartProtein: '#32D74B',
        chartFat: '#FF9500',
        chartCalories: '#FF00F5',
        chartSteps: '#00D9FF',
        
        // Misc
        overlay: 'rgba(0, 0, 0, 0.85)',
        shadow: '#000000',
        
        // Gradient presets (object form)
        gradient: {
            primary: ['#9B00FF', '#5A60EA'],
            accent: ['#FF00F5', '#FF2D92'],
            neon: ['#00CFFF', '#9B00FF', '#FF00F5'],
            cardBorder: ['#0074dd', '#5c00dd', '#dd0095'],
        },
        
        // Individual gradient arrays
        gradientNeonBlue: ['#0074dd', '#5c00dd', '#dd0095'],
        gradientNeonPink: ['#FF00F5', '#9B00FF', '#00CFFF'],
        gradientNeonGreen: ['#00FF85', '#00CFFF'],
        gradientNeonPurple: ['#9B00FF', '#BB86FC'],
        gradientNeonOrange: ['#FF9500', '#FFD700'],
        gradientNeonCyan: ['#00CFFF', '#00FFFF', '#00FF85', '#00CFFF'],
        gradientNeonRed: ['#FF453A', '#FF0000'],
        gradientNeonYellow: ['#FFD700', '#FFFF00'],
    },
};

export const lightTheme: Theme = {
    dark: false,
    colors: {
        // Backgrounds & Surfaces - Purple-tinted background with warm cream cards
        background: '#F7F6FB',         // Subtle purple tint - easier on eyes
        surface: '#FAF9F7',            // Warm cream/ivory - neutral, no ring overlap
        cardBackground: '#FAF9F7',     // Warm cream cards for cozy feel
        inputBackground: '#F5F4F2',    // Warm-tinted input fields
        
        // Text hierarchy - Strong contrast on light
        text: '#1A1A1C',               // Near black for maximum contrast
        textSecondary: '#5A5A66',
        textMuted: '#9A9AA3',
        
        // Brand & Accents - Controlled purple, not harsh
        primary: '#6B00B8',            // Slightly desaturated for light mode
        primaryVariant: '#8B00E6',
        secondary: '#5046C8',
        accent: '#9B00FF',             // Keep accent for highlights only
        
        // Icons - Proper contrast
        iconPrimary: '#2E2E33',
        iconSecondary: '#7A7A85',
        
        // Borders & Dividers - Warm neutral to complement cream cards
        border: '#E8E6E2',             // Warm grey border
        borderStrong: '#D5D3CF',       // Stronger warm border
        
        // Status colors - Balanced saturation for light mode
        success: '#2D9F4A',            // Slightly deeper green
        error: '#E53935',
        warning: '#F5A623',
        
        // Navigation - Warm cream for consistency with cards
        tabBarBackground: '#FAF9F7',   // Matches cards/surface
        tabBarActive: '#6B00B8',
        tabBarInactive: '#9A9AA3',
        headerBackground: '#FAF9F7',   // Matches cards/surface
        
        // Chart/Ring colors - Bold and readable on light
        ringBackground: '#ECEAF2',     // Purple-tinted ring background
        chartCarbs: '#2979FF',         // Deeper blue
        chartProtein: '#2D9F4A',       // Match success
        chartFat: '#F5A623',           // Match warning
        chartCalories: '#8B00E6',      // Brand purple
        chartSteps: '#0091EA',
        
        // Misc
        overlay: 'rgba(0, 0, 0, 0.5)',
        shadow: 'rgba(0, 0, 0, 0.08)', // Subtle shadow for cards
        
        // Gradient presets - ONLY for highlights, NOT for card borders
        gradient: {
            primary: ['#6B00B8', '#5046C8'],
            accent: ['#8B00E6', '#6B00B8'],
            neon: ['#00B4D8', '#8B00E6', '#E040FB'],  // Softer neon
            cardBorder: ['transparent', 'transparent', 'transparent'], // NO gradient borders in light mode!
        },
        
        // Individual gradient arrays - Softer versions for light mode
        gradientNeonBlue: ['#2979FF', '#5046C8', '#8B00E6'],
        gradientNeonPink: ['#E040FB', '#8B00E6', '#00B4D8'],
        gradientNeonGreen: ['#2D9F4A', '#00B4D8'],
        gradientNeonPurple: ['#6B00B8', '#8B00E6'],
        gradientNeonOrange: ['#F5A623', '#FFB74D'],
        gradientNeonCyan: ['#00B4D8', '#26C6DA', '#2D9F4A', '#00B4D8'],
        gradientNeonRed: ['#E53935', '#EF5350'],
        gradientNeonYellow: ['#FFB74D', '#FFC107'],
    },
};
