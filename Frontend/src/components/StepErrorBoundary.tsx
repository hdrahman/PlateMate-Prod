import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class StepErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🚨 StepErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 StepErrorBoundary error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI that doesn't crash the app
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>Step tracking temporarily unavailable</Text>
          <Text style={styles.subText}>App functionality continues normally</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  subText: {
    color: '#999',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default StepErrorBoundary;