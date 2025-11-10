import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ViewStyle,
    ListRenderItemInfo,
} from 'react-native';

interface WheelPickerProps {
    /**
     * Items to display. `id` should be unique; `label` is what the user sees.
     */
    data: Array<{ id: string; label: string }>;
    /**
     * Currently selected item id.
     */
    selectedValue: string;
    /**
     * Callback when the user picks a new value.
     */
    onValueChange: (value: string) => void;
    /**
     * Optional style overrides for the outer container.
     */
    containerStyle?: ViewStyle;
    /**
     * Height of an individual item in pixels. Defaults to 48.
     */
    itemHeight?: number;
    /**
     * Optional default value to scroll to initially (overrides selectedValue for first render).
     * Useful for weight/height pickers to start at sensible defaults.
     */
    defaultValue?: string;
}

const VISIBLE_ROWS = 5; // Must be odd to keep a single centred row

const WheelPicker: React.FC<WheelPickerProps> = ({
    data,
    selectedValue,
    onValueChange,
    containerStyle,
    itemHeight = 48,
    defaultValue,
}) => {
    const listRef = useRef<FlatList>(null);
    const ITEM_HEIGHT = itemHeight;
    const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
    const hasScrolledToDefault = useRef(false);

    // Add empty items at the beginning and end to make all items selectable
    const paddingCount = Math.floor(VISIBLE_ROWS / 2);
    const paddedData = useMemo(() => {
        const emptyTop = Array.from({ length: paddingCount }, (_, i) => ({
            id: `empty_top_${i}`,
            label: '',
        }));
        const emptyBottom = Array.from({ length: paddingCount }, (_, i) => ({
            id: `empty_bottom_${i}`,
            label: '',
        }));
        return [...emptyTop, ...data, ...emptyBottom];
    }, [data, paddingCount]);

    // Memoised mapping from id → index for O(1) lookup
    const idToIndex = useMemo(() => {
        const map: Record<string, number> = {};
        paddedData.forEach((item, idx) => {
            map[item.id] = idx;
        });
        return map;
    }, [paddedData]);

    /** Scroll to the default value on initial mount */
    useEffect(() => {
        if (hasScrolledToDefault.current || !listRef.current) return;

        const valueToScrollTo = defaultValue || selectedValue;
        const targetIndex = idToIndex[valueToScrollTo];

        if (targetIndex != null) {
            // Adjust so that the desired row is centered
            const offset = Math.max(0, (targetIndex - paddingCount) * ITEM_HEIGHT);
            setTimeout(() => {
                listRef.current?.scrollToOffset({
                    offset,
                    animated: false,
                });
                hasScrolledToDefault.current = true;
            }, 100);
        }
    }, [selectedValue, idToIndex, ITEM_HEIGHT, defaultValue, paddingCount]);

    /** Called when momentum scrolling ends naturally - FIXED calculation */
    const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        // FIXED: Simple calculation - the centered item index
        const centerIndex = Math.round(offsetY / ITEM_HEIGHT) + paddingCount;
        const clampedIndex = Math.max(paddingCount, Math.min(centerIndex, paddedData.length - 1 - paddingCount));
        const selectedItem = paddedData[clampedIndex];

        // Only update if it's a real item (not an empty padding item) and different from current
        if (selectedItem && selectedItem.label && selectedItem.id !== selectedValue) {
            onValueChange(selectedItem.id);
        }
    }, [ITEM_HEIGHT, paddedData, selectedValue, onValueChange, paddingCount]);

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
    }), [ITEM_HEIGHT]);

    const renderItem = useCallback(({ item, index }: ListRenderItemInfo<{ id: string; label: string }>) => {
        // Don't show anything for empty padding items
        if (!item.label) {
            return <View style={{ height: ITEM_HEIGHT }} />;
        }

        // FIXED: Use actual selection state, not fixed center calculation
        const isSelected = item.id === selectedValue;

        return (
            <View style={[styles.itemContainer, { height: ITEM_HEIGHT }]}>
                <Text
                    style={[
                        styles.itemText,
                        isSelected && styles.selectedText,
                    ]}
                    numberOfLines={1}
                >
                    {item.label}
                </Text>
            </View>
        );
    }, [ITEM_HEIGHT, selectedValue]);

    const keyExtractor = useCallback((item: { id: string; label: string }) => item.id, []);

    return (
        <View
            style={[
                styles.container,
                { height: CONTAINER_HEIGHT },
                containerStyle,
            ]}
        >
            {/* Selection highlight */}
            <View
                pointerEvents="none"
                style={[
                    styles.selectionIndicator,
                    {
                        top: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2,
                        height: ITEM_HEIGHT,
                    },
                ]}
            />

            <FlatList
                ref={listRef}
                data={paddedData}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumScrollEnd}
                scrollEventThrottle={16}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    itemContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    itemText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '400',
    },
    selectedText: {
        fontSize: 20,
        color: '#fff',
        fontWeight: '700',
    },
    adjacentText: {
        fontSize: 17,
        color: '#bbb',
        fontWeight: '500',
    },
    selectionIndicator: {
        position: 'absolute',
        left: 12,
        right: 12,
        backgroundColor: 'rgba(138, 43, 226, 0.15)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(138, 43, 226, 0.4)',
        zIndex: 1,
    },
});

export default WheelPicker;