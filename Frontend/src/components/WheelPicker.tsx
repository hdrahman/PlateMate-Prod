import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    TouchableOpacity,
    Platform,
    NativeSyntheticEvent,
    NativeScrollEvent
} from 'react-native';

interface WheelPickerProps {
    data: Array<{ id: string, label: string, description?: string }>;
    selectedValue: string;
    onValueChange: (value: string) => void;
    itemHeight?: number;
    containerHeight?: number;
    textStyle?: any;
    selectedTextStyle?: any;
    containerStyle?: any;
}

const WheelPicker: React.FC<WheelPickerProps> = ({
    data,
    selectedValue,
    onValueChange,
    itemHeight = 40,
    containerHeight = 200,
    textStyle,
    selectedTextStyle,
    containerStyle,
}) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const [initialized, setInitialized] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scrollPosition, setScrollPosition] = useState(0);

    // Find index of selected value
    useEffect(() => {
        const index = Math.max(0, data.findIndex(item => item.id === selectedValue));
        if (index !== currentIndex) {
            setCurrentIndex(index);

            // Only scroll if already initialized
            if (initialized && scrollViewRef.current) {
                scrollToIndex(index, true);
            }
        }
    }, [selectedValue, data]);

    // Scroll to initial position after component mounts
    useEffect(() => {
        if (!initialized && data.length > 0) {
            const initialIndex = Math.max(0, data.findIndex(item => item.id === selectedValue));
            setCurrentIndex(initialIndex);

            // Use a longer timeout for initial rendering
            const timer = setTimeout(() => {
                if (scrollViewRef.current) {
                    scrollToIndex(initialIndex, false);
                    setInitialized(true);
                }
            }, 150);

            return () => clearTimeout(timer);
        }
    }, [data]);

    const scrollToIndex = (index: number, animated: boolean = true) => {
        if (scrollViewRef.current) {
            const y = index * itemHeight;
            scrollViewRef.current.scrollTo({
                y,
                animated,
            });
        }
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        setScrollPosition(y);
    };

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        const index = Math.round(y / itemHeight);

        if (index >= 0 && index < data.length) {
            // Ensure we snap to the exact position with precision
            const exactPosition = index * itemHeight;
            if (Math.abs(y - exactPosition) > 1) {
                // Re-align to exact position
                setTimeout(() => {
                    scrollToIndex(index, true);
                }, 10);
            }

            // Only update if value changed
            if (index !== currentIndex) {
                setCurrentIndex(index);
                onValueChange(data[index].id);
            }
        }
    };

    const handleItemPress = (index: number) => {
        scrollToIndex(index);
        setCurrentIndex(index);
        onValueChange(data[index].id);
    };

    // Add padding to top and bottom so center item is centered
    const visibleItems = Math.floor(containerHeight / itemHeight);
    const halfVisibleItems = Math.floor(visibleItems / 2);
    const paddingTop = halfVisibleItems * itemHeight;
    const paddingBottom = paddingTop;

    return (
        <View style={[styles.container, { height: containerHeight }, containerStyle]}>
            {/* Highlight for the selected item - fixed positioning */}
            <View
                style={[
                    styles.highlightView,
                    {
                        top: Math.floor(containerHeight / 2 - itemHeight / 2),
                        height: itemHeight
                    }
                ]}
            />

            <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.9}
                onScroll={handleScroll}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop, paddingBottom }}
                keyboardShouldPersistTaps="always"
                snapToAlignment="center"
            >
                {data.map((item, index) => {
                    const itemPosition = index * itemHeight;
                    const distanceFromCenter = Math.abs(scrollPosition - itemPosition);
                    const isSelected = index === currentIndex;

                    // Scale and opacity based on distance from center
                    const maxDistance = containerHeight / 2;
                    const scale = isSelected ? 1.1 : Math.max(0.8, 1 - distanceFromCenter / maxDistance * 0.2);
                    const opacity = Math.max(0.4, 1 - distanceFromCenter / maxDistance * 0.6);

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.item, { height: itemHeight }]}
                            onPress={() => handleItemPress(index)}
                            activeOpacity={0.7}
                        >
                            <View style={{
                                transform: [{ scale }],
                                opacity,
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: '100%'
                            }}>
                                <Text
                                    style={[
                                        styles.text,
                                        textStyle,
                                        isSelected && styles.selectedText,
                                        isSelected && selectedTextStyle,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        borderRadius: 10,
        overflow: 'hidden',
    },
    highlightView: {
        position: 'absolute',
        width: '100%',
        backgroundColor: 'rgba(0, 116, 221, 0.2)',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0, 116, 221, 0.5)',
        zIndex: 1,
    },
    item: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 2, // Add a small padding to improve alignment
    },
    text: {
        fontSize: 16,
        color: '#aaa',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    selectedText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default WheelPicker; 