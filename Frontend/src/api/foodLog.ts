import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { FoodItem } from './nutritionix';

// Interface for a food log entry
export interface FoodLogEntry {
    id?: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    saturated_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitamin_a: number;
    vitamin_c: number;
    calcium: number;
    iron: number;
    image_url: string;
    file_key: string;
    healthiness_rating?: number;
    date: string;
    meal_type: string;
    brand_name?: string;
    quantity?: string;
    notes?: string;
}

/**
 * Add a food item to the food log
 */
export const addFoodEntry = async (
    foodItem: FoodItem,
    mealType: string,
    quantity: number,
    userId: number = 1
): Promise<FoodLogEntry> => {
    try {
        const meal_id = getMealIdFromType(mealType);

        const foodLogEntry: Omit<FoodLogEntry, 'id'> = {
            meal_id,
            user_id: userId,
            food_name: foodItem.food_name,
            calories: foodItem.calories,
            proteins: foodItem.proteins,
            carbs: foodItem.carbs,
            fats: foodItem.fats,
            fiber: foodItem.fiber,
            sugar: foodItem.sugar,
            saturated_fat: foodItem.saturated_fat,
            polyunsaturated_fat: foodItem.polyunsaturated_fat,
            monounsaturated_fat: foodItem.monounsaturated_fat,
            trans_fat: foodItem.trans_fat,
            cholesterol: foodItem.cholesterol,
            sodium: foodItem.sodium,
            potassium: foodItem.potassium,
            vitamin_a: foodItem.vitamin_a,
            vitamin_c: foodItem.vitamin_c,
            calcium: foodItem.calcium,
            iron: foodItem.iron,
            image_url: foodItem.image || '',
            file_key: 'default_file_key',
            healthiness_rating: foodItem.healthiness_rating,
            date: new Date().toISOString(),
            meal_type: mealType,
            brand_name: foodItem.brand_name,
            quantity: `${quantity} ${foodItem.serving_unit}`,
            notes: foodItem.notes
        };

        const response = await axios.post(
            `${BACKEND_URL}/create`,
            foodLogEntry
        );

        return { ...foodLogEntry, id: response.data.id };
    } catch (error) {
        console.error('Error adding food entry:', error);
        throw new Error('Failed to add food to log');
    }
};

/**
 * Get food log entries for a specific date
 */
export const getFoodLogsByDate = async (date: Date): Promise<FoodLogEntry[]> => {
    try {
        const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        const response = await axios.get(`${BACKEND_URL}/by-date/${formattedDate}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching food logs:', error);
        return [];
    }
};

/**
 * Get recent food entries
 */
export const getRecentFoodEntries = async (limit: number = 10): Promise<FoodLogEntry[]> => {
    try {
        // Since there's no direct endpoint for recent entries, we'll get today's entries
        const today = new Date();
        const entries = await getFoodLogsByDate(today);

        // Sort by most recent first and limit the number of results
        return entries
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, limit);
    } catch (error) {
        console.error('Error fetching recent food entries:', error);
        return [];
    }
};

/**
 * Get meal ID from meal type
 */
const getMealIdFromType = (mealType: string): number => {
    switch (mealType.toLowerCase()) {
        case 'breakfast':
            return 1;
        case 'lunch':
            return 2;
        case 'dinner':
            return 3;
        case 'snack':
            return 4;
        default:
            return 1; // Default to breakfast
    }
}; 