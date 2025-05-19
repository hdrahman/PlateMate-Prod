import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    StatusBar,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Picker } from '@react-native-picker/picker';

interface GoalsData {
    targetWeight?: number;
    calorieGoal?: number;
    proteinGoal?: number;
    carbGoal?: number;
    fatGoal?: number;
    fitnessGoal?: string;
    activityLevel?: string;
}

export default function EditGoals() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [targetWeight, setTargetWeight] = useState('');
    const [calorieGoal, setCalorieGoal] = useState('');
    const [proteinGoal, setProteinGoal] = useState('');
    const [carbGoal, setCarbGoal] = useState('');
    const [fatGoal, setFatGoal] = useState('');
    const [fitnessGoal, setFitnessGoal] = useState('maintain');
    const [activityLevel, setActivityLevel] = useState('moderate');

    useEffect(() => {
        // This would typically fetch the user's goals from a database
        // For now, we'll simulate this with placeholder data

        // Simulate retrieving data from Firestore
        const fetchUserGoals = async () => {
            try {
                // In a real app, you would get this from Firestore or another database
                // For example:
                // const db = firebase.firestore();
                // const userDoc = await db.collection('users').doc(user.uid).get();
                // const userData = userDoc.data();

                // Instead, we'll use placeholder data
                const userData = {
                    targetWeight: 70,
                    calorieGoal: 2000,
                    proteinGoal: 150,
                    carbGoal: 200,
                    fatGoal: 65,
                    fitnessGoal: 'maintain',
                    activityLevel: 'moderate'
                };

                setTargetWeight(userData.targetWeight?.toString() || '');
                setCalorieGoal(userData.calorieGoal?.toString() || '');
                setProteinGoal(userData.proteinGoal?.toString() || '');
                setCarbGoal(userData.carbGoal?.toString() || '');
                setFatGoal(userData.fatGoal?.toString() || '');
                setFitnessGoal(userData.fitnessGoal || 'maintain');
                setActivityLevel(userData.activityLevel || 'moderate');
            } catch (error) {
                console.error('Error fetching user goals', error);
            }
        };

        if (user) {
            fetchUserGoals();
        }
    }, [user]);

    const handleSave = async () => {
        setIsLoading(true);

        try {
            const goalsData: GoalsData = {
                targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
                calorieGoal: calorieGoal ? parseInt(calorieGoal) : undefined,
                proteinGoal: proteinGoal ? parseInt(proteinGoal) : undefined,
                carbGoal: carbGoal ? parseInt(carbGoal) : undefined,
                fatGoal: fatGoal ? parseInt(fatGoal) : undefined,
                fitnessGoal,
                activityLevel
            };

            // In a real app, you would save this to Firestore or another database
            // For example:
            // const db = firebase.firestore();
            // await db.collection('users').doc(user.uid).update(goalsData);

            // Simulate saving data
            await new Promise(resolve => setTimeout(resolve, 1000));

            Alert.alert('Success', 'Fitness goals updated successfully');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to update goals. Please try again.');
            console.error('Goals update error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Fitness Goals</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Weight & Calorie Goals</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Target Weight (kg)</Text>
                        <TextInput
                            style={styles.input}
                            value={targetWeight}
                            onChangeText={setTargetWeight}
                            placeholder="Enter target weight"
                            placeholderTextColor="#888"
                            keyboardType="decimal-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Daily Calorie Goal</Text>
                        <TextInput
                            style={styles.input}
                            value={calorieGoal}
                            onChangeText={setCalorieGoal}
                            placeholder="Enter calorie goal"
                            placeholderTextColor="#888"
                            keyboardType="number-pad"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Macronutrient Goals (g)</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Protein (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={proteinGoal}
                            onChangeText={setProteinGoal}
                            placeholder="Enter protein goal"
                            placeholderTextColor="#888"
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Carbohydrates (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={carbGoal}
                            onChangeText={setCarbGoal}
                            placeholder="Enter carbohydrate goal"
                            placeholderTextColor="#888"
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Fat (g)</Text>
                        <TextInput
                            style={styles.input}
                            value={fatGoal}
                            onChangeText={setFatGoal}
                            placeholder="Enter fat goal"
                            placeholderTextColor="#888"
                            keyboardType="number-pad"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Profile</Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Fitness Goal</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={fitnessGoal}
                                onValueChange={(value) => setFitnessGoal(value)}
                                style={styles.picker}
                                dropdownIconColor="#FFF"
                            >
                                <Picker.Item label="Lose Weight" value="lose" />
                                <Picker.Item label="Maintain Weight" value="maintain" />
                                <Picker.Item label="Gain Weight" value="gain" />
                                <Picker.Item label="Build Muscle" value="build" />
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Activity Level</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={activityLevel}
                                onValueChange={(value) => setActivityLevel(value)}
                                style={styles.picker}
                                dropdownIconColor="#FFF"
                            >
                                <Picker.Item label="Sedentary (office job)" value="sedentary" />
                                <Picker.Item label="Light Activity (1-2 days/week)" value="light" />
                                <Picker.Item label="Moderate Activity (3-5 days/week)" value="moderate" />
                                <Picker.Item label="Very Active (6-7 days/week)" value="active" />
                                <Picker.Item label="Athletic (2x per day)" value="athletic" />
                            </Picker>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Goals</Text>
                    )}
                </TouchableOpacity>
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
        paddingBottom: 40,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#9B00FF',
        marginBottom: 15,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#FFF',
        fontSize: 16,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1A1A1A',
        color: '#FFF',
        height: 50,
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    pickerContainer: {
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        color: '#FFF',
    },
    saveButton: {
        backgroundColor: '#9B00FF',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
