import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Image,
    Platform,
} from 'react-native';
// If you use icons, install/react-native-vector-icons or your preferred icon library
// import Icon from 'react-native-vector-icons/Ionicons';

const mockDiaryData = {
    goal: 1800,
    food: 1637,
    exercise: 450,
    meals: [
        {
            title: 'Breakfast',
            total: 600,
            macros: { carbs: 0, fat: 0, protein: 100 },
            items: [
                { name: 'Quick Add\nProtein 14.0g', calories: 210 },
                { name: 'Quick Add\nProtein 33.0g', calories: 390 },
            ],
        },
        {
            title: 'Lunch',
            total: 1037,
            macros: { carbs: 0, fat: 0, protein: 100 },
            items: [
                { name: 'Quick Add\nProtein 50.0g', calories: 900 },
            ],
        },
    ],
    exerciseList: [
        { name: '600\n60 minutes', cals: 600 },
        { name: 'Connect a step tracker\nAutomatically track steps and calories burned', cals: 0 },
    ],
};

const DiaryScreen: React.FC = () => {
    const { goal, food, exercise, meals, exerciseList } = mockDiaryData;
    const remaining = goal - food + exercise;

    return (
        <SafeAreaView style={styles.container}>
            {/* NAV BAR */}
            <View style={styles.navBar}>
                <TouchableOpacity style={styles.navBtn}>
                    {/* 
            If you have an icon library:
            <Icon name="arrow-back" size={24} color="#fff" />
          */}
                    <Text style={styles.navBtnText}>{'<'} </Text>
                </TouchableOpacity>
                <Text style={styles.navTitle}>Today</Text>
                {/* Could place icons (lightning bolt, message, etc.) on the right side */}
                <View style={styles.navRight} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollInner}>
                {/* Premium Banner */}
                <View style={styles.premiumBanner}>
                    <Text style={styles.premiumText}>Say goodbye to ads.</Text>
                    <TouchableOpacity style={styles.premiumBtn}>
                        <Text style={styles.premiumBtnText}>Go Premium</Text>
                    </TouchableOpacity>
                </View>

                {/* CALORIES SUMMARY */}
                <View style={styles.calorieSummaryCard}>
                    <Text style={styles.sectionHeading}>Calories Remaining</Text>
                    {/* The row: 1800 - 1637 + 450 = 613 */}
                    <View style={styles.equationRow}>
                        <Text style={styles.equationValue}>{goal}</Text>
                        <Text style={styles.equationSign}>-</Text>
                        <Text style={styles.equationValue}>{food}</Text>
                        <Text style={styles.equationSign}>+</Text>
                        <Text style={styles.equationValue}>{exercise}</Text>
                        <Text style={styles.equationSign}>=</Text>
                        <Text style={styles.equationResult}>{remaining}</Text>
                    </View>
                </View>

                {/* MEALS */}
                {meals.map((meal, idx) => (
                    <View key={idx} style={styles.mealSection}>
                        <View style={styles.mealHeader}>
                            <Text style={styles.mealTitle}>{meal.title}</Text>
                            <Text style={styles.mealTotal}>{meal.total}</Text>
                        </View>
                        <Text style={styles.macros}>
                            Carbs {meal.macros.carbs}% • Fat {meal.macros.fat}% • Protein {meal.macros.protein}%
                        </Text>
                        {meal.items.map((item, i) => (
                            <View key={i} style={styles.foodRow}>
                                <Text style={styles.foodName}>{item.name}</Text>
                                <Text style={styles.foodCals}>{item.calories}</Text>
                            </View>
                        ))}
                        {/* 3-dot menu on the right, for example */}
                        <TouchableOpacity style={styles.addBtn}>
                            <Text style={styles.addBtnText}>ADD FOOD</Text>
                        </TouchableOpacity>
                        {idx < meals.length - 1 && <View style={styles.divider} />}
                    </View>
                ))}

                {/* EXERCISE */}
                <View style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                        <Text style={styles.mealTitle}>Exercise</Text>
                        <Text style={styles.mealTotal}>{exercise}</Text>
                    </View>
                    {exerciseList.map((ex, i) => (
                        <View key={i} style={styles.foodRow}>
                            <Text style={styles.foodName}>{ex.name}</Text>
                            <Text style={styles.foodCals}>
                                {ex.cals > 0 ? ex.cals : ''}
                            </Text>
                        </View>
                    ))}
                    <TouchableOpacity style={styles.addBtn}>
                        <Text style={styles.addBtnText}>ADD EXERCISE</Text>
                    </TouchableOpacity>
                </View>

                {/* WATER */}
                <View style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                        <Text style={styles.mealTitle}>Water</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn}>
                        <Text style={styles.addBtnText}>ADD WATER</Text>
                    </TouchableOpacity>
                </View>

                {/* ACTION TABS (Nutrition | Notes | Complete Diary) */}
                <View style={styles.footerBar}>
                    <TouchableOpacity style={styles.footerTab}>
                        <Text style={styles.footerTabText}>Nutrition</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.footerTab}>
                        <Text style={styles.footerTabText}>Notes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.completeBtn}>
                        <Text style={styles.completeBtnText}>Complete Diary</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DiaryScreen;

/** COLORS & FONTS (adjust to fit your brand) */
const DARK_BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const TEXT_COLOR = '#FFFFFF';
const SUBTEXT_COLOR = '#AAAAAA';
const ACCENT_BLUE = '#2296F3'; // MFP’s typical accent, you can change to purple if desired

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DARK_BG,
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'android' ? 8 : 0,
        paddingBottom: 8,
    },
    navBtn: {
        paddingRight: 10,
    },
    navBtnText: {
        color: ACCENT_BLUE,
        fontSize: 20,
    },
    navTitle: {
        color: TEXT_COLOR,
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    navRight: {
        width: 30,
    },
    premiumBanner: {
        backgroundColor: CARD_BG,
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    premiumText: {
        color: SUBTEXT_COLOR,
        fontSize: 14,
    },
    premiumBtn: {
        backgroundColor: ACCENT_BLUE,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 6,
    },
    premiumBtnText: {
        color: TEXT_COLOR,
        fontWeight: '600',
    },
    scrollInner: {
        paddingBottom: 60,
    },
    calorieSummaryCard: {
        backgroundColor: CARD_BG,
        marginHorizontal: 12,
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
    },
    sectionHeading: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    equationRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
    },
    equationValue: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '500',
        marginRight: 6,
    },
    equationSign: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '300',
        marginRight: 6,
    },
    equationResult: {
        color: ACCENT_BLUE,
        fontSize: 18,
        fontWeight: '700',
        marginRight: 6,
    },
    mealSection: {
        backgroundColor: CARD_BG,
        marginHorizontal: 12,
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    mealTitle: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '600',
    },
    mealTotal: {
        color: TEXT_COLOR,
        fontSize: 16,
        fontWeight: '600',
    },
    macros: {
        color: SUBTEXT_COLOR,
        fontSize: 13,
        marginBottom: 8,
    },
    foodRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 6,
    },
    foodName: {
        color: TEXT_COLOR,
        fontSize: 14,
        width: '80%',
        lineHeight: 18,
    },
    foodCals: {
        color: TEXT_COLOR,
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'right',
    },
    addBtn: {
        marginTop: 8,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: ACCENT_BLUE,
        borderRadius: 6,
        alignItems: 'center',
    },
    addBtnText: {
        color: ACCENT_BLUE,
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: SUBTEXT_COLOR,
        opacity: 0.3,
        marginTop: 12,
    },
    footerBar: {
        flexDirection: 'row',
        backgroundColor: DARK_BG,
        marginTop: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: '#3A3A3C',
    },
    footerTab: {
        flex: 1,
        marginRight: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: ACCENT_BLUE,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    footerTabText: {
        color: ACCENT_BLUE,
        fontWeight: '600',
    },
    completeBtn: {
        flex: 1.5,
        backgroundColor: ACCENT_BLUE,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    completeBtnText: {
        color: TEXT_COLOR,
        fontWeight: '700',
    },
});
