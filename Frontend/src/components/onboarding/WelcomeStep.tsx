import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    FlatList,
    Animated,
    ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { scale, spacing, fontSize, wp, hp, size, borderRadius } from '../../utils/responsive';

import IntroStep1 from './IntroStep1';
import IntroStep2 from './IntroStep2';
import IntroStep3 from './IntroStep3';

const { width, height } = Dimensions.get('window');

interface WelcomeStepProps {
    onNext: () => void;
}

interface ViewableItemsChangedInfo {
    viewableItems: Array<ViewToken>;
    changed: Array<ViewToken>;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList>(null);

    const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const handleStep1Next = () => {
        flatListRef.current?.scrollToIndex({ index: 1, animated: true });
        setCurrentIndex(1);
    };

    const handleStep2Next = () => {
        flatListRef.current?.scrollToIndex({ index: 2, animated: true });
        setCurrentIndex(2);
    };

    const handleStep3Next = () => {
        onNext();
    };

    // All intro steps now navigate directly to onboarding
    const handleStartOnboarding = () => {
        onNext();
    };

    const renderItem = ({ item, index }: { item: number; index: number }) => {
        switch (index) {
            case 0:
                return <IntroStep1 onNext={handleStartOnboarding} />;
            case 1:
                return <IntroStep2 onNext={handleStartOnboarding} />;
            case 2:
                return <IntroStep3 onNext={handleStartOnboarding} />;
            default:
                return null;
        }
    };

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 200, // ms the item needs to be visible before changing
        waitForInteraction: true
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={[0, 1, 2]}
                renderItem={renderItem}
                keyExtractor={(item) => item.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={width}
                decelerationRate="fast"
                snapToAlignment="center"
                disableIntervalMomentum={true}
                snapToOffsets={[0, width, width * 2]}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
            />

            <View style={styles.pagination}>
                {[0, 1, 2].map((_, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [size(8), size(16), size(8)],
                        extrapolate: 'clamp',
                    });

                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={i}
                            style={[
                                styles.dot,
                                { width: dotWidth, opacity }
                            ]}
                        />
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: width,
        backgroundColor: '#000',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: scale(40),
        position: 'absolute',
        bottom: spacing(23),
        width: '100%',
    },
    dot: {
        height: size(8),
        borderRadius: size(4),
        backgroundColor: '#fff',
        marginHorizontal: spacing(1),
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing(10),
    },
    welcomeText: {
        fontSize: fontSize('3xl'),
        color: '#fff',
        marginBottom: spacing(2),
    },
    appName: {
        fontSize: fontSize('4xl'),
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -1,
    },
    tagline: {
        fontSize: fontSize('lg'),
        color: '#aaa',
        marginTop: spacing(2),
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing(5),
    },
    image: {
        width: wp(50),
        height: wp(50),
    },
    featuresContainer: {
        marginBottom: spacing(10),
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing(6),
        paddingHorizontal: spacing(5),
    },
    featureIcon: {
        width: size(50),
        height: size(50),
        borderRadius: size(25),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing(4),
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: fontSize('xl'),
        fontWeight: '600',
        color: '#fff',
        marginBottom: spacing(1),
    },
    featureDescription: {
        fontSize: fontSize('md'),
        color: '#aaa',
        lineHeight: scale(20),
    },
    getStartedContainer: {
        alignItems: 'center',
        paddingHorizontal: spacing(5),
    },
    getStartedText: {
        fontSize: fontSize('lg'),
        color: '#fff',
        textAlign: 'center',
        marginBottom: spacing(6),
    },
    button: {
        width: '100%',
        borderRadius: borderRadius('lg'),
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing(4),
    },
    buttonText: {
        color: '#fff',
        fontSize: fontSize('xl'),
        fontWeight: '600',
        marginRight: spacing(2),
    },
});

export default WelcomeStep; 