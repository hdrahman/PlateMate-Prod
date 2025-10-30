# PlateMate Universal Minimalist Dark Theme

## Overview
PlateMate uses a carefully designed **monochromatic dark theme** using only black, white, and gray tones. This creates a clean, focused, and timeless aesthetic that puts content first.

## Design Philosophy
- **Pure Black Background** (#000000) - True OLED black for battery efficiency on iPhone
- **High Contrast Text** (#FFFFFF) - Maximum readability
- **Subtle Gray Variations** - Only for borders, dividers, and secondary elements
- **No Colors** - Except for critical status indicators (use sparingly)
- **iOS Native Feel** - Matches iOS dark mode standards

## Usage

### 1. Import the Theme
```typescript
import { useTheme } from '../ThemeContext';
import THEME, { commonStyles, withOpacity } from '../styles/theme';

// In your component
const MyScreen = () => {
  const { theme } = useTheme();
  
  return (
    <View style={[commonStyles.container]}>
      {/* Your content */}
    </View>
  );
};
```

### 2. Use Theme Colors
```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.background.primary,
  },
  card: {
    backgroundColor: THEME.background.tertiary,
    borderColor: THEME.border.default,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
  },
  title: {
    color: THEME.text.primary,
    fontSize: THEME.typography.fontSize.xl,
    fontWeight: THEME.typography.fontWeight.bold,
  },
  subtitle: {
    color: THEME.text.secondary,
    fontSize: THEME.typography.fontSize.sm,
  },
});
```

### 3. Use Common Styles
```typescript
// Instead of defining styles from scratch, use commonStyles
<View style={commonStyles.card}>
  <Text style={commonStyles.heading}>Welcome</Text>
  <Text style={commonStyles.body}>This is a minimalist interface</Text>
</View>

<TouchableOpacity style={commonStyles.primaryButton}>
  <Text style={commonStyles.primaryButtonText}>Continue</Text>
</TouchableOpacity>
```

### 4. Create Semi-Transparent Colors
```typescript
// For overlays or subtle backgrounds
<View style={{
  backgroundColor: withOpacity(THEME.text.primary, 0.1)
}}>
  {/* Content */}
</View>
```

## Color Palette Reference

### Backgrounds
- **Primary** (#000000) - Main app background
- **Secondary** (#0A0A0A) - Slightly elevated
- **Tertiary** (#121212) - Cards and containers
- **Elevated** (#1A1A1A) - Modals and overlays

### Text
- **Primary** (#FFFFFF) - Main text
- **Secondary** (#B3B3B3) - Less important text
- **Tertiary** (#808080) - Hints and placeholders
- **Disabled** (#4D4D4D) - Disabled state

### Borders
- **Default** (#2A2A2A) - Standard borders
- **Light** (#1A1A1A) - Subtle dividers
- **Medium** (#404040) - Emphasized borders
- **Heavy** (#666666) - High contrast

## Migration Guide

### Replace Old Color Constants
```typescript
// OLD (scattered throughout codebase)
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';

// NEW (centralized)
import THEME from '../styles/theme';

// Use THEME.background.primary instead of PRIMARY_BG
// Use THEME.background.tertiary instead of CARD_BG
// Use THEME.text.primary instead of WHITE
// Use THEME.text.secondary instead of SUBDUED
```

### Update StyleSheets
```typescript
// BEFORE
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    padding: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17,
  },
});

// AFTER
const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.background.primary,
    padding: THEME.spacing.md,
  },
  text: {
    color: THEME.text.primary,
    fontSize: THEME.typography.fontSize.lg,
  },
});
```

## iOS-Specific Considerations

### Safe Area
```typescript
import { SafeAreaView } from 'react-native-safe-area-context';
import THEME from '../styles/theme';

<SafeAreaView 
  style={{ 
    flex: 1, 
    backgroundColor: THEME.background.primary 
  }}
  edges={['top', 'left', 'right']}
>
  {/* Content */}
</SafeAreaView>
```

### Shadows (iOS uses shadow properties, not elevation)
```typescript
const styles = StyleSheet.create({
  card: {
    ...THEME.shadows.md,  // Applies iOS-compatible shadow
    backgroundColor: THEME.background.tertiary,
  },
});
```

### Touch Targets
```typescript
// All interactive elements should be minimum 44pt tall (iOS HIG)
const styles = StyleSheet.create({
  button: {
    ...commonStyles.primaryButton, // Already includes minHeight: 44
  },
});
```

## Best Practices

1. **Consistency** - Always use theme constants, never hardcode colors
2. **Spacing** - Use the 8pt grid system (THEME.spacing)
3. **Typography** - Use predefined font sizes and weights
4. **Borders** - Keep them subtle (1px, light gray)
5. **Shadows** - Use sparingly, white shadows with low opacity
6. **Status Colors** - Use white/gray for status, rely on icons and context

## Example Screen

See `Frontend/src/screens/ExampleThemeScreen.tsx` for a complete example showing all theme elements in use.

## Performance Tips

1. **Memoize Styles** - Use `useMemo` or define styles outside component
2. **Avoid Inline Styles** - Use StyleSheet.create for optimization
3. **Use Common Styles** - Reduces duplicate style objects

```typescript
// GOOD - Styles defined once
const styles = StyleSheet.create({
  container: commonStyles.container,
});

// AVOID - Creates new object on every render
<View style={{ backgroundColor: THEME.background.primary }} />
```

## Testing on Device

The theme looks best on actual iPhone hardware with OLED displays:
- Pure black (#000000) saves battery on OLED
- High contrast text improves readability in sunlight
- Subtle shadows create depth without distraction
