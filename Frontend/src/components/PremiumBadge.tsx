import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';

interface PremiumBadgeProps {
    size?: 'small' | 'medium' | 'large';
    type?: 'badge' | 'button' | 'tag';
    text?: string;
    showIcon?: boolean;
}

const PremiumBadge: React.FC<PremiumBadgeProps> = ({
    size = 'medium',
    type = 'badge',
    text = 'Premium',
    showIcon = true
}) => {
    const navigation = useNavigation<any>();
    const { theme, isDarkTheme } = useContext(ThemeContext);

    const handlePress = () => {
        if (type === 'button') {
            navigation.navigate('PremiumSubscription' as never);
        }
    };

    // Size-based styles
    const sizeStyles = {
        small: {
            height: 20,
            paddingHorizontal: 8,
            fontSize: 10,
            iconSize: 10,
        },
        medium: {
            height: 28,
            paddingHorizontal: 12,
            fontSize: 12,
            iconSize: 14,
        },
        large: {
            height: 36,
            paddingHorizontal: 16,
            fontSize: 14,
            iconSize: 18,
        }
    };

    const currentSize = sizeStyles[size];
    const colors = [theme.colors.primary, theme.colors.secondary] as [ColorValue, ColorValue];

    if (type === 'tag') {
        return (
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    styles.tag,
                    { height: currentSize.height, paddingHorizontal: currentSize.paddingHorizontal }
                ]}
            >
                {showIcon && (
                    <Ionicons
                        name="star"
                        size={currentSize.iconSize}
                        color={theme.colors.text}
                        style={styles.icon}
                    />
                )}
                <Text style={[styles.text, { fontSize: currentSize.fontSize, color: theme.colors.text }]}>
                    {text}
                </Text>
            </LinearGradient>
        );
    }

    const Component = type === 'button' ? TouchableOpacity : View;

    return (
        <Component
            style={[
                styles.container,
                { height: currentSize.height }
            ]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                    styles.badge,
                    { height: currentSize.height, paddingHorizontal: currentSize.paddingHorizontal }
                ]}
            >
                {showIcon && (
                    <Ionicons
                        name="star"
                        size={currentSize.iconSize}
                        color={theme.colors.text}
                        style={styles.icon}
                    />
                )}
                <Text style={[styles.text, { fontSize: currentSize.fontSize, color: theme.colors.text }]}>
                    {text}
                </Text>
            </LinearGradient>
        </Component>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 100,
        overflow: 'hidden',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
    },
    icon: {
        marginRight: 4,
    },
    text: {
        fontWeight: 'bold',
    }
});

export default PremiumBadge; 