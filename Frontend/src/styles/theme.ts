/**
 * PlateMate Universal Minimalist Dark Theme
 * 
 * A carefully crafted monochromatic palette using only black, white, and gray tones.
 * Designed for optimal readability and focus on content.
 */

export const THEME = {
  // Background Colors - Pure black foundation
  background: {
    primary: '#000000',      // Main app background - Pure black
    secondary: '#0A0A0A',    // Slightly elevated surfaces
    tertiary: '#121212',     // Cards and containers
    elevated: '#1A1A1A',     // Modals and overlays
  },

  // Text Colors - High contrast for readability
  text: {
    primary: '#FFFFFF',      // Primary text - Pure white
    secondary: '#B3B3B3',    // Secondary text - Light gray
    tertiary: '#808080',     // Tertiary text - Medium gray
    disabled: '#4D4D4D',     // Disabled state - Dark gray
    inverse: '#000000',      // Text on light backgrounds
  },

  // Border Colors - Subtle separation
  border: {
    default: '#2A2A2A',      // Standard borders
    light: '#1A1A1A',        // Subtle dividers
    medium: '#404040',       // Emphasized borders
    heavy: '#666666',        // High contrast borders
  },

  // Interactive Elements
  interactive: {
    default: '#FFFFFF',      // Default interactive state
    hover: '#E6E6E6',        // Hover state
    active: '#CCCCCC',       // Active/pressed state
    disabled: '#333333',     // Disabled state
  },

  // Status Colors - Monochromatic with opacity
  status: {
    success: '#FFFFFF',      // Use with low opacity for subtle feedback
    error: '#FFFFFF',        // Use with context (borders/icons)
    warning: '#CCCCCC',      
    info: '#B3B3B3',
  },

  // Overlay Colors - For modals and backdrops
  overlay: {
    light: 'rgba(0, 0, 0, 0.5)',
    medium: 'rgba(0, 0, 0, 0.7)',
    heavy: 'rgba(0, 0, 0, 0.9)',
  },

  // Component-specific colors
  components: {
    // Input fields
    input: {
      background: '#1A1A1A',
      border: '#2A2A2A',
      text: '#FFFFFF',
      placeholder: '#666666',
    },
    
    // Buttons
    button: {
      primary: {
        background: '#FFFFFF',
        text: '#000000',
      },
      secondary: {
        background: '#2A2A2A',
        text: '#FFFFFF',
      },
      ghost: {
        background: 'transparent',
        text: '#FFFFFF',
        border: '#404040',
      },
    },

    // Cards
    card: {
      background: '#121212',
      border: '#2A2A2A',
      shadow: 'rgba(255, 255, 255, 0.05)', // Subtle white shadow for depth
    },

    // Navigation
    navigation: {
      background: '#000000',
      border: '#1A1A1A',
      active: '#FFFFFF',
      inactive: '#666666',
    },

    // Progress/Loading
    progress: {
      background: '#2A2A2A',
      fill: '#FFFFFF',
      track: '#1A1A1A',
    },
  },

  // iOS-specific adjustments
  ios: {
    // Use iOS system colors for native feel
    systemGray: '#8E8E93',
    systemGray2: '#636366',
    systemGray3: '#48484A',
    systemGray4: '#3A3A3C',
    systemGray5: '#2C2C2E',
    systemGray6: '#1C1C1E',
  },

  // Gradients (minimal use, black to gray)
  gradients: {
    subtle: ['#000000', '#1A1A1A'],
    medium: ['#000000', '#2A2A2A'],
    card: ['#0A0A0A', '#121212'],
  },

  // Spacing (8pt grid system for iOS)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Border Radius
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },

  // Typography
  typography: {
    fontSize: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 22,
      xxl: 28,
      xxxl: 34,
    },
    fontWeight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },

  // Shadows (iOS-style)
  shadows: {
    sm: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    md: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    lg: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
  },
};

/**
 * Helper function to create semi-transparent colors
 * @param color - Base color (hex)
 * @param opacity - Opacity (0-1)
 */
export const withOpacity = (color: string, opacity: number): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Common style patterns for consistency
 */
export const commonStyles = {
  // Container styles
  container: {
    flex: 1,
    backgroundColor: THEME.background.primary,
  },

  // Card styles
  card: {
    backgroundColor: THEME.background.tertiary,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.border.default,
  },

  // Text styles
  heading: {
    fontSize: THEME.typography.fontSize.xl,
    fontWeight: THEME.typography.fontWeight.bold,
    color: THEME.text.primary,
  },
  
  body: {
    fontSize: THEME.typography.fontSize.md,
    fontWeight: THEME.typography.fontWeight.regular,
    color: THEME.text.primary,
  },

  caption: {
    fontSize: THEME.typography.fontSize.sm,
    fontWeight: THEME.typography.fontWeight.regular,
    color: THEME.text.secondary,
  },

  // Button styles
  primaryButton: {
    backgroundColor: THEME.components.button.primary.background,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 44, // iOS touch target
  },

  primaryButtonText: {
    color: THEME.components.button.primary.text,
    fontSize: THEME.typography.fontSize.md,
    fontWeight: THEME.typography.fontWeight.semibold,
  },

  // Input styles
  input: {
    backgroundColor: THEME.components.input.background,
    borderWidth: 1,
    borderColor: THEME.components.input.border,
    borderRadius: THEME.radius.md,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
    color: THEME.components.input.text,
    fontSize: THEME.typography.fontSize.md,
    minHeight: 44, // iOS touch target
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: THEME.border.light,
  },
};

export default THEME;
