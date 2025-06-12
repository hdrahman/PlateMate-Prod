import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jest } from '@jest/globals';

// Mock React Native modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-camera', () => 'Camera');

// Import screens to test
import MealLoggingScreen from '../../screens/MealLoggingScreen';
import FoodSearchScreen from '../../screens/FoodSearchScreen';
import NutritionFactsScreen from '../../screens/NutritionFactsScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: jest.fn(),
};

// Mock API service
jest.mock('../../services/api', () => ({
    searchFood: jest.fn(),
    logMeal: jest.fn(),
    getMealHistory: jest.fn(),
    analyzeImage: jest.fn(),
}));

import { searchFood, logMeal, getMealHistory, analyzeImage } from '../../services/api';

// Helper function to render with navigation
const renderWithNavigation = (component) => {
    return render(
        <NavigationContainer>
            {component}
        </NavigationContainer>
    );
};

describe('MealLoggingScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AsyncStorage.getItem.mockResolvedValue('mock-token');
    });

    test('renders meal logging screen correctly', async () => {
        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        expect(screen.getByText('Log Your Meal')).toBeTruthy();
        expect(screen.getByPlaceholderText('Search for food')).toBeTruthy();
        expect(screen.getByText('Take Photo')).toBeTruthy();
        expect(screen.getByText('Manual Entry')).toBeTruthy();
    });

    test('handles food search input', async () => {
        searchFood.mockResolvedValue([
            {
                id: 1,
                name: 'Apple',
                calories: 95,
                proteins: 0.5,
                carbs: 25,
                fats: 0.3,
            },
        ]);

        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        const searchInput = screen.getByPlaceholderText('Search for food');
        fireEvent.changeText(searchInput, 'apple');

        await waitFor(() => {
            expect(searchFood).toHaveBeenCalledWith('apple');
        });

        expect(screen.getByText('Apple')).toBeTruthy();
        expect(screen.getByText('95 cal')).toBeTruthy();
    });

    test('handles meal type selection', async () => {
        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        const breakfastButton = screen.getByText('Breakfast');
        fireEvent.press(breakfastButton);

        expect(breakfastButton.props.style).toContainEqual(
            expect.objectContaining({ backgroundColor: expect.any(String) })
        );
    });

    test('logs meal successfully', async () => {
        logMeal.mockResolvedValue({ id: 1, success: true });

        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        // Simulate selecting a food item
        const searchInput = screen.getByPlaceholderText('Search for food');
        fireEvent.changeText(searchInput, 'apple');

        // Wait for search results and select food
        await waitFor(() => {
            const appleItem = screen.getByText('Apple');
            fireEvent.press(appleItem);
        });

        // Select meal type
        const lunchButton = screen.getByText('Lunch');
        fireEvent.press(lunchButton);

        // Enter serving quantity
        const quantityInput = screen.getByPlaceholderText('Quantity');
        fireEvent.changeText(quantityInput, '1');

        // Log the meal
        const logButton = screen.getByText('Log Meal');
        fireEvent.press(logButton);

        await waitFor(() => {
            expect(logMeal).toHaveBeenCalledWith({
                food_name: 'Apple',
                meal_type: 'lunch',
                serving_qty: 1,
                calories: 95,
                proteins: 0.5,
                carbs: 25,
                fats: 0.3,
            });
        });

        expect(screen.getByText('Meal logged successfully!')).toBeTruthy();
    });

    test('handles camera photo capture', async () => {
        analyzeImage.mockResolvedValue({
            recognized_foods: [
                {
                    name: 'Grilled Chicken',
                    confidence: 0.92,
                    nutrition: {
                        calories: 185,
                        proteins: 35,
                        carbs: 0,
                        fats: 4,
                    },
                },
            ],
        });

        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        const photoButton = screen.getByText('Take Photo');
        fireEvent.press(photoButton);

        // Simulate camera modal opening
        expect(screen.getByTestId('camera-modal')).toBeTruthy();

        // Simulate taking a photo
        const captureButton = screen.getByTestId('capture-button');
        fireEvent.press(captureButton);

        await waitFor(() => {
            expect(analyzeImage).toHaveBeenCalled();
        });

        expect(screen.getByText('Grilled Chicken')).toBeTruthy();
        expect(screen.getByText('185 cal')).toBeTruthy();
    });

    test('handles manual food entry', async () => {
        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        const manualButton = screen.getByText('Manual Entry');
        fireEvent.press(manualButton);

        expect(mockNavigate).toHaveBeenCalledWith('ManualFoodEntry');
    });

    test('displays error for invalid quantity', async () => {
        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        const quantityInput = screen.getByPlaceholderText('Quantity');
        fireEvent.changeText(quantityInput, '-1');

        const logButton = screen.getByText('Log Meal');
        fireEvent.press(logButton);

        expect(screen.getByText('Please enter a valid quantity')).toBeTruthy();
    });

    test('shows loading state during meal logging', async () => {
        logMeal.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        // Set up meal data
        const quantityInput = screen.getByPlaceholderText('Quantity');
        fireEvent.changeText(quantityInput, '1');

        const logButton = screen.getByText('Log Meal');
        fireEvent.press(logButton);

        expect(screen.getByTestId('loading-indicator')).toBeTruthy();
    });

    test('handles API error during meal logging', async () => {
        logMeal.mockRejectedValue(new Error('Network error'));

        renderWithNavigation(<MealLoggingScreen navigation={mockNavigation} />);

        const logButton = screen.getByText('Log Meal');
        fireEvent.press(logButton);

        await waitFor(() => {
            expect(screen.getByText('Failed to log meal. Please try again.')).toBeTruthy();
        });
    });
});

describe('FoodSearchScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders food search screen correctly', () => {
        renderWithNavigation(<FoodSearchScreen navigation={mockNavigation} />);

        expect(screen.getByPlaceholderText('Search for food...')).toBeTruthy();
        expect(screen.getByText('Recent Searches')).toBeTruthy();
    });

    test('performs food search with debouncing', async () => {
        searchFood.mockResolvedValue([
            { id: 1, name: 'Banana', calories: 105 },
            { id: 2, name: 'Apple', calories: 95 },
        ]);

        renderWithNavigation(<FoodSearchScreen navigation={mockNavigation} />);

        const searchInput = screen.getByPlaceholderText('Search for food...');

        // Type quickly to test debouncing
        fireEvent.changeText(searchInput, 'a');
        fireEvent.changeText(searchInput, 'ap');
        fireEvent.changeText(searchInput, 'app');

        // Should only make one API call after debounce delay
        await waitFor(() => {
            expect(searchFood).toHaveBeenCalledTimes(1);
            expect(searchFood).toHaveBeenCalledWith('app');
        });

        expect(screen.getByText('Apple')).toBeTruthy();
        expect(screen.getByText('Banana')).toBeTruthy();
    });

    test('displays empty state for no search results', async () => {
        searchFood.mockResolvedValue([]);

        renderWithNavigation(<FoodSearchScreen navigation={mockNavigation} />);

        const searchInput = screen.getByPlaceholderText('Search for food...');
        fireEvent.changeText(searchInput, 'xyz123');

        await waitFor(() => {
            expect(screen.getByText('No foods found')).toBeTruthy();
            expect(screen.getByText('Try a different search term')).toBeTruthy();
        });
    });

    test('navigates to nutrition facts on food selection', async () => {
        searchFood.mockResolvedValue([
            { id: 1, name: 'Apple', calories: 95, proteins: 0.5 },
        ]);

        renderWithNavigation(<FoodSearchScreen navigation={mockNavigation} />);

        const searchInput = screen.getByPlaceholderText('Search for food...');
        fireEvent.changeText(searchInput, 'apple');

        await waitFor(() => {
            const appleItem = screen.getByText('Apple');
            fireEvent.press(appleItem);
        });

        expect(mockNavigate).toHaveBeenCalledWith('NutritionFacts', {
            food: { id: 1, name: 'Apple', calories: 95, proteins: 0.5 },
        });
    });

    test('stores and displays recent searches', async () => {
        AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['pizza', 'salad']));

        renderWithNavigation(<FoodSearchScreen navigation={mockNavigation} />);

        await waitFor(() => {
            expect(screen.getByText('pizza')).toBeTruthy();
            expect(screen.getByText('salad')).toBeTruthy();
        });
    });

    test('clears recent searches', async () => {
        AsyncStorage.getItem.mockResolvedValue(JSON.stringify(['pizza', 'salad']));

        renderWithNavigation(<FoodSearchScreen navigation={mockNavigation} />);

        const clearButton = screen.getByText('Clear Recent');
        fireEvent.press(clearButton);

        await waitFor(() => {
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('recentSearches');
        });

        expect(screen.queryByText('pizza')).toBeFalsy();
    });
});

describe('NutritionFactsScreen', () => {
    const mockFood = {
        id: 1,
        name: 'Apple',
        calories: 95,
        proteins: 0.5,
        carbs: 25,
        fats: 0.3,
        fiber: 4,
        sugar: 19,
        sodium: 1,
    };

    const mockRoute = {
        params: { food: mockFood },
    };

    test('renders nutrition facts correctly', () => {
        renderWithNavigation(
            <NutritionFactsScreen navigation={mockNavigation} route={mockRoute} />
        );

        expect(screen.getByText('Apple')).toBeTruthy();
        expect(screen.getByText('95')).toBeTruthy(); // calories
        expect(screen.getByText('0.5g')).toBeTruthy(); // proteins
        expect(screen.getByText('25g')).toBeTruthy(); // carbs
        expect(screen.getByText('0.3g')).toBeTruthy(); // fats
    });

    test('adjusts serving size and updates nutrition values', () => {
        renderWithNavigation(
            <NutritionFactsScreen navigation={mockNavigation} route={mockRoute} />
        );

        const servingInput = screen.getByDisplayValue('1');
        fireEvent.changeText(servingInput, '2');

        // Calories should double
        expect(screen.getByText('190')).toBeTruthy(); // 95 * 2
        expect(screen.getByText('1g')).toBeTruthy(); // 0.5 * 2 proteins
        expect(screen.getByText('50g')).toBeTruthy(); // 25 * 2 carbs
    });

    test('handles different serving units', () => {
        renderWithNavigation(
            <NutritionFactsScreen navigation={mockNavigation} route={mockRoute} />
        );

        const unitPicker = screen.getByTestId('serving-unit-picker');
        fireEvent.valueChange(unitPicker, 'cup');

        expect(screen.getByDisplayValue('cup')).toBeTruthy();
    });

    test('adds food to meal log from nutrition facts', async () => {
        logMeal.mockResolvedValue({ success: true });

        renderWithNavigation(
            <NutritionFactsScreen navigation={mockNavigation} route={mockRoute} />
        );

        const addButton = screen.getByText('Add to Meal');
        fireEvent.press(addButton);

        await waitFor(() => {
            expect(logMeal).toHaveBeenCalledWith({
                food_name: 'Apple',
                calories: 95,
                proteins: 0.5,
                carbs: 25,
                fats: 0.3,
                serving_qty: 1,
                serving_unit: 'medium',
            });
        });

        expect(screen.getByText('Added to meal!')).toBeTruthy();
    });

    test('displays macronutrient breakdown chart', () => {
        renderWithNavigation(
            <NutritionFactsScreen navigation={mockNavigation} route={mockRoute} />
        );

        expect(screen.getByTestId('macro-chart')).toBeTruthy();

        // Check if chart shows correct percentages
        const proteinPercentage = Math.round((0.5 * 4 / 95) * 100); // protein calories / total calories
        const carbPercentage = Math.round((25 * 4 / 95) * 100);
        const fatPercentage = Math.round((0.3 * 9 / 95) * 100);

        expect(screen.getByText(`${proteinPercentage}%`)).toBeTruthy();
        expect(screen.getByText(`${carbPercentage}%`)).toBeTruthy();
        expect(screen.getByText(`${fatPercentage}%`)).toBeTruthy();
    });

    test('shows daily value percentages', () => {
        renderWithNavigation(
            <NutritionFactsScreen navigation={mockNavigation} route={mockRoute} />
        );

        // Assuming 2000 calorie diet
        const caloriesDV = Math.round((95 / 2000) * 100);
        expect(screen.getByText(`${caloriesDV}% DV`)).toBeTruthy();
    });
});

describe('MealHistoryScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders meal history correctly', async () => {
        getMealHistory.mockResolvedValue([
            {
                id: 1,
                food_name: 'Apple',
                calories: 95,
                meal_type: 'breakfast',
                created_at: '2023-12-01T08:00:00Z',
            },
            {
                id: 2,
                food_name: 'Chicken Salad',
                calories: 350,
                meal_type: 'lunch',
                created_at: '2023-12-01T12:00:00Z',
            },
        ]);

        renderWithNavigation(<MealHistoryScreen navigation={mockNavigation} />);

        await waitFor(() => {
            expect(screen.getByText('Apple')).toBeTruthy();
            expect(screen.getByText('Chicken Salad')).toBeTruthy();
            expect(screen.getByText('95 cal')).toBeTruthy();
            expect(screen.getByText('350 cal')).toBeTruthy();
        });
    });

    test('groups meals by date', async () => {
        getMealHistory.mockResolvedValue([
            {
                id: 1,
                food_name: 'Apple',
                meal_type: 'breakfast',
                created_at: '2023-12-01T08:00:00Z',
            },
            {
                id: 2,
                food_name: 'Banana',
                meal_type: 'breakfast',
                created_at: '2023-11-30T08:00:00Z',
            },
        ]);

        renderWithNavigation(<MealHistoryScreen navigation={mockNavigation} />);

        await waitFor(() => {
            expect(screen.getByText('December 1, 2023')).toBeTruthy();
            expect(screen.getByText('November 30, 2023')).toBeTruthy();
        });
    });

    test('allows editing meal entries', async () => {
        getMealHistory.mockResolvedValue([
            {
                id: 1,
                food_name: 'Apple',
                calories: 95,
                meal_type: 'breakfast',
                serving_qty: 1,
            },
        ]);

        renderWithNavigation(<MealHistoryScreen navigation={mockNavigation} />);

        await waitFor(() => {
            const editButton = screen.getByTestId('edit-meal-1');
            fireEvent.press(editButton);
        });

        expect(mockNavigate).toHaveBeenCalledWith('EditMeal', {
            meal: expect.objectContaining({ id: 1, food_name: 'Apple' }),
        });
    });

    test('allows deleting meal entries', async () => {
        getMealHistory.mockResolvedValue([
            {
                id: 1,
                food_name: 'Apple',
                calories: 95,
                meal_type: 'breakfast',
            },
        ]);

        renderWithNavigation(<MealHistoryScreen navigation={mockNavigation} />);

        await waitFor(() => {
            const deleteButton = screen.getByTestId('delete-meal-1');
            fireEvent.press(deleteButton);
        });

        // Should show confirmation dialog
        expect(screen.getByText('Delete Meal')).toBeTruthy();
        expect(screen.getByText('Are you sure you want to delete this meal?')).toBeTruthy();

        const confirmButton = screen.getByText('Delete');
        fireEvent.press(confirmButton);

        // Meal should be removed from list
        await waitFor(() => {
            expect(screen.queryByText('Apple')).toBeFalsy();
        });
    });

    test('displays daily calorie totals', async () => {
        getMealHistory.mockResolvedValue([
            {
                id: 1,
                food_name: 'Apple',
                calories: 95,
                created_at: '2023-12-01T08:00:00Z',
            },
            {
                id: 2,
                food_name: 'Banana',
                calories: 105,
                created_at: '2023-12-01T10:00:00Z',
            },
        ]);

        renderWithNavigation(<MealHistoryScreen navigation={mockNavigation} />);

        await waitFor(() => {
            expect(screen.getByText('Total: 200 calories')).toBeTruthy();
        });
    });
}); 