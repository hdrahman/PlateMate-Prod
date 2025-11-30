import React, { useState, useContext } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Linking,
    StatusBar,
    SafeAreaView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../ThemeContext';

// Accent colors that remain constant
const ACCENT_BLUE = '#2196F3';
const ACCENT_GREEN = '#4CAF50';

// Gradient border card wrapper component
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
    cardBackground?: string;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style, cardBackground }) => {
    return (
        <View style={staticStyles.gradientBorderContainer}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 16,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View
                style={{
                    margin: 1.5,
                    borderRadius: 15,
                    backgroundColor: style?.backgroundColor || cardBackground,
                    padding: 16,
                    ...style
                }}
            >
                {children}
            </View>
        </View>
    );
};

interface CalculationSection {
    id: string;
    title: string;
    formula: string;
    description: string;
    citations: Citation[];
}

interface Citation {
    text: string;
    url?: string;
}

export default function AboutCalculations() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { theme } = useContext(ThemeContext);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const styles = createStyles(theme);

    const toggleSection = (id: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedSections(newExpanded);
    };

    const openLink = async (url: string) => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    };

    const calculations: CalculationSection[] = [
        {
            id: 'bmr',
            title: 'Basal Metabolic Rate (BMR)',
            formula: 'Mifflin-St Jeor Equation\n\nMen: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5\n\nWomen: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161',
            description: 'BMR represents the number of calories your body needs to perform basic life-sustaining functions at rest. This includes breathing, circulation, nutrient processing, and cell production.',
            citations: [
                {
                    text: 'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. American Journal of Clinical Nutrition. 1990;51(2):241-247.',
                    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/'
                },
                {
                    text: 'Academy of Nutrition and Dietetics. Evidence Analysis Library: Predictive Equations for Resting Metabolic Rate.',
                    url: 'https://www.andeal.org/'
                }
            ]
        },
        {
            id: 'tdee',
            title: 'Total Daily Energy Expenditure (TDEE)',
            formula: 'TDEE = BMR × Activity Factor\n\nActivity Factors:\n• Sedentary (little/no exercise): 1.2\n• Light (1-3 days/week): 1.375\n• Moderate (3-5 days/week): 1.55\n• Active (6-7 days/week): 1.725\n• Extremely Active (daily intense): 1.9',
            description: 'TDEE represents your total calorie expenditure including all physical activity. We multiply your BMR by an activity factor based on your exercise frequency and intensity.',
            citations: [
                {
                    text: 'World Health Organization/Food and Agriculture Organization/United Nations University. Human Energy Requirements: Report of a Joint FAO/WHO/UNU Expert Consultation. 2001.',
                    url: 'https://www.fao.org/3/y5686e/y5686e00.htm'
                },
                {
                    text: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Washington, DC: National Academies Press; 2005.',
                    url: 'https://www.nap.edu/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids'
                }
            ]
        },
        {
            id: 'weight_goals',
            title: 'Weight Goal Adjustments',
            formula: 'Calorie Adjustment = (Weight Goal in kg/week) × 7700 calories ÷ 7 days\n\nExamples:\n• Lose 0.5 kg/week: -550 cal/day\n• Gain 0.5 kg/week: +550 cal/day\n\n1 kg of body fat ≈ 7700 calories',
            description: 'To lose or gain weight, we adjust your daily calorie target. One kilogram of body fat equals approximately 7,700 calories. Safe weight loss/gain rates are typically 0.25-1 kg per week.',
            citations: [
                {
                    text: 'Hall KD, Sacks G, Chandramohan D, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet. 2011;378(9793):826-837.',
                    url: 'https://pubmed.ncbi.nlm.nih.gov/21872751/'
                },
                {
                    text: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services. Dietary Guidelines for Americans, 2020-2025.',
                    url: 'https://www.dietaryguidelines.gov/'
                }
            ]
        },
        {
            id: 'protein',
            title: 'Protein Requirements',
            formula: 'Protein = 1.0-2.0 g/kg body weight\n\nVariations by goal:\n• Maintenance: 1.0-1.2 g/kg\n• Weight loss: 1.2-1.6 g/kg\n• Muscle gain: 1.6-2.2 g/kg\n• Athletes: 1.4-2.0 g/kg',
            description: 'Protein needs vary based on activity level, fitness goals, and body composition. Higher protein intake helps preserve muscle mass during weight loss and supports muscle growth during training.',
            citations: [
                {
                    text: 'Phillips SM, Van Loon LJ. Dietary protein for athletes: from requirements to optimum adaptation. Journal of Sports Sciences. 2011;29(sup1):S29-S38.',
                    url: 'https://pubmed.ncbi.nlm.nih.gov/22150425/'
                },
                {
                    text: 'Institute of Medicine. Dietary Reference Intakes: Macronutrients. Acceptable Macronutrient Distribution Ranges (AMDR) for protein: 10-35% of total calories.',
                    url: 'https://www.nap.edu/read/10490/'
                }
            ]
        },
        {
            id: 'carbs_fats',
            title: 'Carbohydrate & Fat Distribution',
            formula: 'After allocating protein calories:\n\nCarbohydrates: 45-65% of total calories (4 cal/gram)\nFats: 20-35% of total calories (9 cal/gram)\n\nDistribution varies by individual preference and health goals.',
            description: 'After meeting protein requirements, remaining calories are distributed between carbohydrates and fats based on dietary preferences, activity level, and health conditions.',
            citations: [
                {
                    text: 'U.S. Department of Agriculture. Dietary Guidelines for Americans 2020-2025: Acceptable Macronutrient Distribution Ranges.',
                    url: 'https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf'
                },
                {
                    text: 'American Heart Association. Dietary Fats. Recommendations for fat intake: 25-35% of total daily calories.',
                    url: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/dietary-fats'
                }
            ]
        },
        {
            id: 'fiber',
            title: 'Fiber Recommendations',
            formula: 'Daily Fiber = 14 grams per 1000 calories\n\nTypical recommendations:\n• Women: 25 grams/day\n• Men: 38 grams/day',
            description: 'Adequate fiber intake supports digestive health, helps maintain healthy cholesterol levels, and promotes satiety.',
            citations: [
                {
                    text: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. 2005.',
                    url: 'https://www.nap.edu/catalog/10490/'
                },
                {
                    text: 'American Heart Association. Whole Grains, Refined Grains, and Dietary Fiber.',
                    url: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/whole-grains-refined-grains-and-dietary-fiber'
                }
            ]
        },
        {
            id: 'sodium',
            title: 'Sodium Guidelines',
            formula: 'Standard: 2,300 mg/day maximum\nHypertension: 1,500 mg/day recommended',
            description: 'Sodium intake is adjusted based on health conditions. Lower sodium intake is recommended for individuals with high blood pressure or cardiovascular concerns.',
            citations: [
                {
                    text: 'American Heart Association. How much sodium should I eat per day? Recommendation: No more than 2,300 mg/day, ideally 1,500 mg for most adults.',
                    url: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/how-much-sodium-should-i-eat-per-day'
                },
                {
                    text: 'U.S. Food and Drug Administration. Sodium in Your Diet.',
                    url: 'https://www.fda.gov/food/nutrition-education-resources-materials/sodium-your-diet'
                }
            ]
        },
        {
            id: 'micronutrients',
            title: 'Vitamins & Minerals',
            formula: 'Based on Dietary Reference Intakes (DRIs)\n\nKey nutrients tracked:\n• Vitamin A, C, D, E, K\n• B-complex vitamins\n• Calcium, Iron, Magnesium\n• Potassium, Zinc',
            description: 'Micronutrient recommendations are based on established Dietary Reference Intakes (DRIs) set by the National Academies of Sciences, Engineering, and Medicine.',
            citations: [
                {
                    text: 'National Institutes of Health, Office of Dietary Supplements. Dietary Reference Intakes (DRIs): Recommended Dietary Allowances and Adequate Intakes.',
                    url: 'https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx'
                },
                {
                    text: 'Institute of Medicine. Dietary Reference Intakes: The Essential Guide to Nutrient Requirements. Washington, DC: National Academies Press; 2006.',
                    url: 'https://www.nap.edu/catalog/11537/dietary-reference-intakes-the-essential-guide-to-nutrient-requirements'
                }
            ]
        }
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
                <TouchableOpacity
                    style={staticStyles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Our Calculations</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Medical Disclaimer */}
                <View style={staticStyles.medicalDisclaimerBanner}>
                    <Ionicons name="medical" size={24} color="#FF9500" />
                    <View style={staticStyles.medicalDisclaimerContent}>
                        <Text style={staticStyles.medicalDisclaimerTitle}>Important Medical Notice</Text>
                        <Text style={styles.medicalDisclaimerText}>
                            PlateMate is a nutrition tracking tool, not a medical device or diagnostic tool.
                            Always consult with a qualified healthcare professional, registered dietitian, or
                            physician before making changes to your diet or starting any weight management program,
                            especially if you have any medical conditions.
                        </Text>
                    </View>
                </View>

                {/* Introduction */}
                <View style={staticStyles.introSection}>
                    <Ionicons name="calculator" size={40} color={ACCENT_BLUE} />
                    <Text style={styles.introTitle}>Evidence-Based Nutrition Science</Text>
                    <Text style={styles.introText}>
                        PlateMate uses scientifically validated formulas and guidelines from leading health organizations to calculate your personalized nutrition targets. All calculations are based on peer-reviewed research and established dietary guidelines.
                    </Text>
                </View>

                {/* Calculation Sections */}
                {calculations.map((calc) => {
                    const isExpanded = expandedSections.has(calc.id);
                    return (
                        <GradientBorderCard key={calc.id} cardBackground={theme.colors.cardBackground}>
                            <TouchableOpacity
                                onPress={() => toggleSection(calc.id)}
                                activeOpacity={0.7}
                            >
                                <View style={staticStyles.sectionHeader}>
                                    <View style={staticStyles.sectionTitleRow}>
                                        <Ionicons
                                            name="flask"
                                            size={22}
                                            color={ACCENT_GREEN}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text style={styles.sectionTitle}>{calc.title}</Text>
                                    </View>
                                    <Ionicons
                                        name={isExpanded ? "chevron-up" : "chevron-down"}
                                        size={20}
                                        color={theme.colors.textSecondary}
                                    />
                                </View>
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={staticStyles.sectionContent}>
                                    <Text style={styles.descriptionText}>{calc.description}</Text>

                                    <View style={staticStyles.formulaContainer}>
                                        <Text style={staticStyles.formulaLabel}>Formula:</Text>
                                        <Text style={styles.formulaText}>{calc.formula}</Text>
                                    </View>

                                    <View style={staticStyles.citationsContainer}>
                                        <Text style={styles.citationsLabel}>Scientific Sources:</Text>
                                        {calc.citations.map((citation, index) => (
                                            <View key={index} style={staticStyles.citationItem}>
                                                <Text style={staticStyles.citationNumber}>{index + 1}.</Text>
                                                <View style={staticStyles.citationTextContainer}>
                                                    <Text style={styles.citationText}>{citation.text}</Text>
                                                    {citation.url && (
                                                        <TouchableOpacity
                                                            style={staticStyles.linkButton}
                                                            onPress={() => openLink(citation.url!)}
                                                        >
                                                            <Text style={staticStyles.linkButtonText}>View Source</Text>
                                                            <Ionicons name="open-outline" size={14} color={ACCENT_BLUE} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </GradientBorderCard>
                    );
                })}

                {/* Disclaimer */}
                <View style={staticStyles.disclaimerSection}>
                    <Ionicons name="information-circle" size={24} color={ACCENT_BLUE} />
                    <Text style={styles.disclaimerText}>
                        These calculations provide general guidance based on population averages and scientific research. Individual needs may vary. Always consult with a healthcare professional or registered dietitian for personalized medical or nutrition advice.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// Dynamic styles that depend on theme
const createStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 16,
    },
    medicalDisclaimerText: {
        fontSize: 13,
        color: theme.colors.text,
        lineHeight: 19,
    },
    introTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
        textAlign: 'center',
    },
    introText: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        lineHeight: 22,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1,
    },
    descriptionText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
    },
    formulaText: {
        fontSize: 13,
        color: theme.colors.text,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 18,
    },
    citationsLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    citationText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        lineHeight: 18,
    },
    disclaimerText: {
        flex: 1,
        fontSize: 13,
        color: theme.colors.textSecondary,
        lineHeight: 19,
    },
});

// Static styles that don't depend on theme
const staticStyles = StyleSheet.create({
    backButton: {
        padding: 8,
        borderRadius: 8,
    },
    medicalDisclaimerBanner: {
        marginTop: 16,
        marginBottom: 8,
        padding: 16,
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 0, 0.3)',
        flexDirection: 'row',
        gap: 12,
    },
    medicalDisclaimerContent: {
        flex: 1,
        gap: 8,
    },
    medicalDisclaimerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF9500',
    },
    introSection: {
        paddingVertical: 24,
        alignItems: 'center',
        gap: 12,
    },
    gradientBorderContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionContent: {
        marginTop: 16,
        gap: 16,
    },
    formulaContainer: {
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        borderRadius: 8,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: ACCENT_BLUE,
    },
    formulaLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: ACCENT_BLUE,
        marginBottom: 6,
    },
    citationsContainer: {
        gap: 12,
    },
    citationItem: {
        flexDirection: 'row',
        gap: 8,
    },
    citationNumber: {
        fontSize: 13,
        color: ACCENT_GREEN,
        fontWeight: '600',
        minWidth: 20,
    },
    citationTextContainer: {
        flex: 1,
        gap: 8,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
    },
    linkButtonText: {
        fontSize: 13,
        color: ACCENT_BLUE,
        fontWeight: '600',
    },
    disclaimerSection: {
        marginTop: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: 'rgba(33, 150, 243, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(33, 150, 243, 0.2)',
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
    },
});
