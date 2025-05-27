import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    TouchableOpacity,
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

    // Find index of selected value
    useEffect(() => {
        const index = data.findIndex(item => item.id === selectedValue);
        if (index !== -1 && index !== currentIndex) {
            setCurrentIndex(index);
            if (initialized && scrollViewRef.current) {
                scrollToIndex(index);
            }
        }
    }, [selectedValue, data]);

    // Scroll to initial position
    useEffect(() => {
        if (scrollViewRef.current && !initialized) {
            const initialIndex = data.findIndex(item => item.id === selectedValue);
            setCurrentIndex(initialIndex !== -1 ? initialIndex : 0);
            setTimeout(() => {
                if (scrollViewRef.current) {
                    scrollToIndex(initialIndex !== -1 ? initialIndex : 0);
                    setInitialized(true);
                }
            }, 10);
        }
    }, [scrollViewRef.current]);

    const scrollToIndex = (index: number) => {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({
                y: index * itemHeight,
                animated: true,
            });
        }
    };

    const handleMomentumScrollEnd = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        const index = Math.round(y / itemHeight);

        if (index >= 0 && index < data.length && scrollViewRef.current) {
            // Snap to the closest item
            scrollToIndex(index);

            // Only update if value changed
            if (index !== currentIndex) {
                setCurrentIndex(index);
                onValueChange(data[index].id);
            }
        }
    };

    // Add padding to top and bottom so center item is centered
    const visibleItems = Math.floor(containerHeight / itemHeight);
    const halfVisibleItems = Math.floor(visibleItems / 2);
    const paddingTop = halfVisibleItems * itemHeight;
    const paddingBottom = paddingTop;

    return (
        <View style={[styles.container, { height: containerHeight }, containerStyle]}>
            {/* Highlight for the selected item */}
            <View style={[styles.highlightView, { top: containerHeight / 2 - itemHeight / 2, height: itemHeight }]} />

            <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumScrollEnd}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop, paddingBottom }}
            >
                {data.map((item, index) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.item, { height: itemHeight }]}
                        onPress={() => {
                            scrollToIndex(index);
                            setCurrentIndex(index);
                            onValueChange(item.id);
                        }}
                    >
                        <Text
                            style={[
                                styles.text,
                                textStyle,
                                index === currentIndex && styles.selectedText,
                                index === currentIndex && selectedTextStyle,
                            ]}
                            numberOfLines={1}
                        >
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}
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