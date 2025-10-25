import { Dimensions, PixelRatio, Platform } from 'react-native';

/**
 * Responsive Design Utility
 *
 * Provides a centralized system for responsive layouts across all device sizes.
 * Based on a 375px base width (iPhone SE/X standard) with proper scaling.
 *
 * Usage:
 * - scale(): Linear scaling for general dimensions
 * - moderateScale(): Scaling with customizable factor for fine-tuning
 * - spacing(): Consistent spacing based on 4px grid system
 * - fontSize(): Semantic font size scaling
 * - wp(): Width percentage of screen
 * - hp(): Height percentage of screen
 * - size(): Square component sizing
 */

// Base dimensions (iPhone SE/X as reference)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 667;

// Get current window dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate scale factors
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Linear scaling based on screen width
 * Best for: margins, padding, component sizes
 */
export const scale = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * widthScale);
};

/**
 * Moderate scaling with resistance factor
 * Best for: font sizes, icon sizes (prevents extreme scaling)
 * @param size - Base size to scale
 * @param factor - Resistance factor (0 = no scaling, 1 = full scaling)
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor);
};

/**
 * Height-based scaling
 * Best for: vertical spacing, component heights
 */
export const verticalScale = (size: number): number => {
  return PixelRatio.roundToNearestPixel(size * heightScale);
};

/**
 * Spacing system based on 4px grid
 * multiplier 1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 5 = 20px, 6 = 24px, 8 = 32px, etc.
 * Scales proportionally with screen size
 */
export const spacing = (multiplier: number): number => {
  return scale(multiplier * 4);
};

/**
 * Width percentage
 * @param percentage - 0-100
 */
export const wp = (percentage: number): number => {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH * percentage) / 100);
};

/**
 * Height percentage
 * @param percentage - 0-100
 */
export const hp = (percentage: number): number => {
  return PixelRatio.roundToNearestPixel((SCREEN_HEIGHT * percentage) / 100);
};

/**
 * Square component sizing (equal width/height)
 */
export const size = (value: number): number => {
  return scale(value);
};

/**
 * Semantic font size scaling
 * Provides consistent typography across screens
 */
export const fontSize = (sizeKey: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'): number => {
  const sizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 22,
    '3xl': 28,
    '4xl': 34,
  };
  return moderateScale(sizes[sizeKey], 0.3); // Lower factor for text to prevent extreme scaling
};

/**
 * Device size helpers
 */
export const isSmallDevice = (): boolean => SCREEN_WIDTH < 375;
export const isLargeDevice = (): boolean => SCREEN_WIDTH >= 414;
export const isTablet = (): boolean => SCREEN_WIDTH >= 768;

/**
 * Platform-specific spacing
 */
export const platformSpacing = (ios: number, android: number): number => {
  return Platform.OS === 'ios' ? spacing(ios) : spacing(android);
};

/**
 * Get current screen dimensions
 */
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  widthScale,
  heightScale,
  isSmall: isSmallDevice(),
  isLarge: isLargeDevice(),
  isTablet: isTablet(),
});

/**
 * Responsive border radius
 */
export const borderRadius = (sizeKey: 'sm' | 'md' | 'lg' | 'xl' | 'full'): number => {
  const sizes = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  };
  return scale(sizes[sizeKey]);
};

/**
 * Responsive shadow
 * Returns platform-specific shadow styles
 */
export const shadow = (elevation: number) => {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: scale(elevation / 2),
      },
      shadowOpacity: 0.1 + (elevation * 0.05),
      shadowRadius: scale(elevation),
    };
  }
  return {
    elevation: elevation,
  };
};

/**
 * Aspect ratio helper
 * Returns responsive width/height based on aspect ratio
 */
export const aspectRatio = (ratio: number, baseWidth?: number) => {
  const width = baseWidth ? scale(baseWidth) : SCREEN_WIDTH;
  return {
    width,
    height: width / ratio,
  };
};

/**
 * Responsive icon size
 */
export const iconSize = (sizeKey: 'sm' | 'md' | 'lg' | 'xl'): number => {
  const sizes = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48,
  };
  return scale(sizes[sizeKey]);
};

/**
 * Hit slop for touchables (improves touch targets on small devices)
 */
export const hitSlop = (size: number = 10) => ({
  top: size,
  bottom: size,
  left: size,
  right: size,
});

/**
 * Minimum touch target size (44x44 for iOS, 48x48 for Android)
 */
export const minTouchTarget = Platform.OS === 'ios' ? 44 : 48;

/**
 * Safe layout spacing
 * Ensures content doesn't touch screen edges
 */
export const safeSpacing = {
  horizontal: spacing(5), // 20px base
  vertical: spacing(4),   // 16px base
};

/**
 * Export dimensions for direct use
 */
export const dimensions = {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  BASE_WIDTH,
  BASE_HEIGHT,
};

export default {
  scale,
  moderateScale,
  verticalScale,
  spacing,
  wp,
  hp,
  size,
  fontSize,
  isSmallDevice,
  isLargeDevice,
  isTablet,
  platformSpacing,
  getScreenDimensions,
  borderRadius,
  shadow,
  aspectRatio,
  iconSize,
  hitSlop,
  minTouchTarget,
  safeSpacing,
  dimensions,
};
