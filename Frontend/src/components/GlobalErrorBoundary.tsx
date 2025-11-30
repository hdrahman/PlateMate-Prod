import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Appearance } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Generic fallback colors that work in both light and dark modes
// Using system appearance to determine fallback colors since error boundaries can't use hooks
const isDarkMode = Appearance.getColorScheme() === 'dark';
const fallbackColors = {
  // Use system appearance for background
  background: isDarkMode ? '#1C1C1E' : '#F2F2F7',
  backgroundSecondary: '#2C2C2E',
  // High contrast text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  // Universal accent colors
  accent: '#FF453A', // Red for error indication
  accentSecondary: '#FF6B6B',
  // Button colors
  buttonBackground: '#0A84FF',
  buttonText: '#FFFFFF',
};

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('🚨 Global Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    // Reset error state to retry
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>⚠️</Text>
            </View>

            {/* Error Title */}
            <Text style={styles.title}>Oops! Something went wrong</Text>

            {/* Error Message */}
            <Text style={styles.message}>
              We encountered an unexpected error. Don't worry, your data is safe.
            </Text>

            {/* Error Details (only in development) */}
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetailsContainer}>
                <Text style={styles.errorDetailsTitle}>Error Details (DEV):</Text>
                <Text style={styles.errorDetails}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorDetails}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}

            {/* Reload Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReload}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Help Text */}
            <Text style={styles.helpText}>
              If the problem persists, please restart the app
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: fallbackColors.background,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: fallbackColors.accent,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 16,
    color: fallbackColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorDetailsContainer: {
    backgroundColor: fallbackColors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    maxHeight: 200,
    width: '100%',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: fallbackColors.accentSecondary,
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 12,
    color: fallbackColors.textSecondary,
    fontFamily: 'monospace',
  },
  button: {
    marginBottom: 16,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: fallbackColors.buttonBackground,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: fallbackColors.buttonText,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: fallbackColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default GlobalErrorBoundary;
