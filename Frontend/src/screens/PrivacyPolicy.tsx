import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    StatusBar,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function PrivacyPolicy() {
    const navigation = useNavigation<any>();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Introduction</Text>
                    <Text style={styles.paragraph}>
                        Welcome to PlateMate! This Privacy Policy explains how we collect, use,
                        disclose, and safeguard your information when you use our mobile application.
                    </Text>
                    <Text style={styles.paragraph}>
                        We respect your privacy and are committed to protecting your personal data.
                        Please read this Privacy Policy carefully to understand our practices.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Information We Collect</Text>
                    <Text style={styles.paragraph}>
                        We may collect several types of information from and about users of our application, including:
                    </Text>

                    <Text style={styles.listTitle}>Personal Data:</Text>
                    <Text style={styles.listItem}>• Name, email address, and contact information</Text>
                    <Text style={styles.listItem}>• Account credentials such as username and password</Text>
                    <Text style={styles.listItem}>• Demographic information such as age and gender</Text>
                    <Text style={styles.listItem}>• Health-related information such as height, weight, and fitness goals</Text>

                    <Text style={styles.listTitle}>Usage Data:</Text>
                    <Text style={styles.listItem}>• Food intake and nutritional information</Text>
                    <Text style={styles.listItem}>• Meal photos and recognition data</Text>
                    <Text style={styles.listItem}>• Log data and analytics about how you use the app</Text>
                    <Text style={styles.listItem}>• Device information including model, OS, and settings</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>How We Use Your Information</Text>
                    <Text style={styles.paragraph}>
                        We use the information we collect to:
                    </Text>
                    <Text style={styles.listItem}>• Provide, maintain, and improve our services</Text>
                    <Text style={styles.listItem}>• Process and complete transactions</Text>
                    <Text style={styles.listItem}>• Send you technical notices and support messages</Text>
                    <Text style={styles.listItem}>• Respond to your comments and questions</Text>
                    <Text style={styles.listItem}>• Develop new products and services</Text>
                    <Text style={styles.listItem}>• Personalize your experience</Text>
                    <Text style={styles.listItem}>• Monitor and analyze usage patterns</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Sharing and Disclosure</Text>
                    <Text style={styles.paragraph}>
                        We may share your information with:
                    </Text>
                    <Text style={styles.listItem}>• Service providers and business partners</Text>
                    <Text style={styles.listItem}>• Analytics partners to improve our service</Text>
                    <Text style={styles.listItem}>• Legal authorities when required by law</Text>
                    <Text style={styles.paragraph}>
                        We do not sell your personal information to third parties.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Rights and Choices</Text>
                    <Text style={styles.paragraph}>
                        You have the right to:
                    </Text>
                    <Text style={styles.listItem}>• Access and update your personal information</Text>
                    <Text style={styles.listItem}>• Request deletion of your data</Text>
                    <Text style={styles.listItem}>• Opt out of marketing communications</Text>
                    <Text style={styles.listItem}>• Control app permissions such as camera and notifications</Text>
                    <Text style={styles.listItem}>• Manage data sharing preferences in app settings</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Security</Text>
                    <Text style={styles.paragraph}>
                        We implement appropriate security measures to protect your personal information.
                        However, no method of transmission over the Internet or electronic storage is
                        100% secure, and we cannot guarantee absolute security.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Changes to This Policy</Text>
                    <Text style={styles.paragraph}>
                        We may update this Privacy Policy from time to time. We will notify you of
                        any changes by posting the new Privacy Policy on this page and updating the
                        "Last Updated" date.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about this Privacy Policy, please contact us at:
                    </Text>
                    <Text style={styles.contactInfo}>privacy@platemate-app.com</Text>
                    <Text style={styles.lastUpdated}>Last Updated: July 2023</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    content: {
        padding: 20,
        paddingBottom: 80,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#9B00FF',
        marginBottom: 15,
    },
    paragraph: {
        fontSize: 15,
        color: '#CCC',
        marginBottom: 12,
        lineHeight: 22,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFF',
        marginTop: 10,
        marginBottom: 8,
    },
    listItem: {
        fontSize: 15,
        color: '#CCC',
        marginBottom: 8,
        paddingLeft: 10,
        lineHeight: 22,
    },
    contactInfo: {
        fontSize: 15,
        color: '#9B00FF',
        marginTop: 8,
        marginBottom: 12,
    },
    lastUpdated: {
        fontSize: 14,
        color: '#888',
        marginTop: 20,
        fontStyle: 'italic',
    }
}); 