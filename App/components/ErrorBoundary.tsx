import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

type ErrorBoundaryProps = {
    children: React.ReactNode;
    fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
};

/**
 * Error Boundary component to catch JavaScript errors in child components.
 * Displays a fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to an external service (e.g., Sentry, Crashlytics)
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <Text style={styles.title}>Something went wrong</Text>
                    <Text style={styles.message}>
                        An unexpected error occurred. Please try again.
                    </Text>
                    {__DEV__ && this.state.error && (
                        <Text style={styles.errorDetails}>
                            {this.state.error.message}
                        </Text>
                    )}
                    <TouchableOpacity
                        style={styles.button}
                        onPress={this.handleRetry}
                        accessibilityLabel="Retry"
                        accessibilityRole="button"
                    >
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
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
        backgroundColor: '#1a1a2e',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#e94560',
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        color: '#a0a0a0',
        textAlign: 'center',
        marginBottom: 20,
    },
    errorDetails: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginBottom: 20,
        fontFamily: 'monospace',
    },
    button: {
        backgroundColor: '#e94560',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
