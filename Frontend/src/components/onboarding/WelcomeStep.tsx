import React, { useState, useRef } from 'react';
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

    const handleViewableItemsChanged = useRef(({ viewableItems }: ViewableItemsChangedInfo) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const handleNextSlide = () => {
        if (currentIndex < 2) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true
            });
        } else {
            onNext();
        }
    };

    const renderItem = ({ item, index }: { item: number; index: number }) => {
        switch (index) {
            case 0:
                return <IntroStep1 onNext={handleNextSlide} />;
            case 1:
                return <IntroStep2 onNext={handleNextSlide} />;
            case 2:
                return <IntroStep3 onNext={handleNextSlide} />;
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
                        outputRange: [8, 16, 8],
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
        height: 40,
        position: 'absolute',
        bottom: 20,
        width: '100%',
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginHorizontal: 4,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    welcomeText: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 8,
    },
    appName: {
        fontSize: 42,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -1,
    },
    tagline: {
        fontSize: 16,
        color: '#aaa',
        marginTop: 8,
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
    },
    image: {
        width: width * 0.5,
        height: width * 0.5,
    },
    featuresContainer: {
        marginBottom: 40,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    featureIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        color: '#aaa',
        lineHeight: 20,
    },
    getStartedContainer: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    getStartedText: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
});

export default WelcomeStep; 