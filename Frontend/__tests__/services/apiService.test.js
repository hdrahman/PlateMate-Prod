import { jest } from '@jest/globals';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock Firebase auth
jest.mock('../../src/utils/firebase/authService', () => ({
    getCurrentUser: jest.fn(() => ({
        getIdToken: jest.fn(() => Promise.resolve('mock-token'))
    })),
}));

// Import actual API files
import { searchFoodByName } from '../../src/api/nutritionix';
import { getUserProfile, updateUserProfile } from '../../src/api/profileApi';
import { getUserData, updateUserData } from '../../src/api/userApi';

describe('Nutritionix API Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.post.mockClear();
        mockedAxios.get.mockClear();
    });

    test('searchFoodByName returns food data correctly', async () => {
        const mockFoodData = {
            data: {
                foods: [
                    {
                        food_name: 'apple',
                        nf_calories: 95,
                        nf_protein: 0.5,
                        nf_total_carbohydrate: 25,
                        nf_total_fat: 0.3,
                    }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockFoodData);

        const result = await searchFoodByName('apple');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining('nutritionix'),
            expect.objectContaining({
                query: 'apple'
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'x-app-id': expect.any(String),
                    'x-app-key': expect.any(String),
                })
            })
        );
        expect(result.foods).toHaveLength(1);
        expect(result.foods[0].food_name).toBe('apple');
    });

    test('searchFoodByName handles API errors', async () => {
        mockedAxios.post.mockRejectedValue(new Error('Network error'));

        await expect(searchFoodByName('invalid-food')).rejects.toThrow('Network error');
    });
});

describe('Profile API Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getUserProfile fetches user profile data', async () => {
        const mockProfileData = {
            data: {
                id: 1,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john@example.com',
                height: 175,
                weight: 70,
                age: 30,
            }
        };

        mockedAxios.get.mockResolvedValue(mockProfileData);

        const result = await getUserProfile();

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('/profile'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Bearer'),
                })
            })
        );
        expect(result.first_name).toBe('John');
        expect(result.email).toBe('john@example.com');
    });

    test('updateUserProfile updates profile data', async () => {
        const updateData = {
            first_name: 'Jane',
            weight: 65,
        };

        const mockResponse = {
            data: {
                ...updateData,
                id: 1,
                updated_at: new Date().toISOString(),
            }
        };

        mockedAxios.put.mockResolvedValue(mockResponse);

        const result = await updateUserProfile(updateData);

        expect(mockedAxios.put).toHaveBeenCalledWith(
            expect.stringContaining('/profile'),
            updateData,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Bearer'),
                })
            })
        );
        expect(result.first_name).toBe('Jane');
        expect(result.weight).toBe(65);
    });

    test('updateUserProfile handles validation errors', async () => {
        const invalidData = {
            weight: -10, // Invalid negative weight
        };

        mockedAxios.put.mockRejectedValue({
            response: {
                status: 422,
                data: { detail: 'Invalid weight value' }
            }
        });

        await expect(updateUserProfile(invalidData)).rejects.toMatchObject({
            response: expect.objectContaining({
                status: 422
            })
        });
    });
});

describe('User API Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getUserData fetches complete user data', async () => {
        const mockUserData = {
            data: {
                user: {
                    id: 1,
                    firebase_uid: 'test-uid',
                    email: 'user@example.com',
                    onboarding_complete: true,
                },
                gamification: {
                    level: 5,
                    xp: 1200,
                    streak_days: 7,
                },
                nutrition_goals: {
                    daily_calorie_goal: 2000,
                    protein_goal: 150,
                }
            }
        };

        mockedAxios.get.mockResolvedValue(mockUserData);

        const result = await getUserData();

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('/users/me'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Bearer'),
                })
            })
        );
        expect(result.user.id).toBe(1);
        expect(result.gamification.level).toBe(5);
        expect(result.nutrition_goals.daily_calorie_goal).toBe(2000);
    });

    test('updateUserData updates user information', async () => {
        const updateData = {
            height: 180,
            activity_level: 'moderate',
        };

        const mockResponse = {
            data: {
                id: 1,
                ...updateData,
                updated_at: new Date().toISOString(),
            }
        };

        mockedAxios.put.mockResolvedValue(mockResponse);

        const result = await updateUserData(updateData);

        expect(mockedAxios.put).toHaveBeenCalledWith(
            expect.stringContaining('/users/me'),
            updateData,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Bearer'),
                })
            })
        );
        expect(result.height).toBe(180);
        expect(result.activity_level).toBe('moderate');
    });
});

describe('Error Handling', () => {
    test('handles 401 authentication errors', async () => {
        mockedAxios.get.mockRejectedValue({
            response: {
                status: 401,
                data: { detail: 'Invalid token' }
            }
        });

        await expect(getUserProfile()).rejects.toMatchObject({
            response: expect.objectContaining({
                status: 401
            })
        });
    });

    test('handles 500 server errors', async () => {
        mockedAxios.post.mockRejectedValue({
            response: {
                status: 500,
                data: { detail: 'Internal server error' }
            }
        });

        await expect(searchFoodByName('test')).rejects.toMatchObject({
            response: expect.objectContaining({
                status: 500
            })
        });
    });

    test('handles network errors', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network Error'));

        await expect(getUserData()).rejects.toThrow('Network Error');
    });
});

describe('API Service Business Logic Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('API request retry logic works correctly', async () => {
        let attemptCount = 0;

        // Mock network failures followed by success
        mockedAxios.get.mockImplementation(() => {
            attemptCount++;
            if (attemptCount <= 2) {
                return Promise.reject(new Error('Network timeout'));
            }
            return Promise.resolve({
                data: {
                    id: 1,
                    first_name: 'John',
                    retry_attempt: attemptCount
                }
            });
        });

        const result = await getUserProfile();

        expect(attemptCount).toBe(3); // Should retry twice before success
        expect(result.first_name).toBe('John');
        expect(result.retry_attempt).toBe(3);
    });

    test('API request timeout handling', async () => {
        const timeoutError = new Error('Request timeout');
        timeoutError.code = 'ECONNABORTED';

        mockedAxios.get.mockRejectedValue(timeoutError);

        const startTime = Date.now();

        try {
            await getUserProfile();
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should timeout quickly, not hang indefinitely
            expect(duration).toBeLessThan(10000); // 10 seconds max
            expect(error.code).toBe('ECONNABORTED');
        }
    });

    test('nutritionix food search validates and transforms data correctly', async () => {
        const mockApiResponse = {
            data: {
                foods: [
                    {
                        food_name: 'apple',
                        nf_calories: 95.5,  // Decimal value
                        nf_protein: null,    // Null value
                        nf_total_carbohydrate: 25,
                        nf_total_fat: 0.3,
                        serving_qty: 1,
                        serving_unit: 'medium',
                        // Missing some expected fields
                    }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockApiResponse);

        const result = await searchFoodByName('apple');

        // Should transform and validate the data
        expect(result.foods).toHaveLength(1);
        const food = result.foods[0];

        // Should round calories to integer
        expect(food.nf_calories).toBe(96);

        // Should handle null protein gracefully
        expect(food.nf_protein).toBe(0);

        // Should add default values for missing fields
        expect(food.hasOwnProperty('nf_dietary_fiber')).toBe(true);
        expect(food.nf_dietary_fiber).toBe(0);

        // Should validate serving information
        expect(food.serving_qty).toBeGreaterThan(0);
        expect(typeof food.serving_unit).toBe('string');
    });

    test('profile update validates data before sending request', async () => {
        const invalidUpdateData = {
            weight: -50,        // Invalid negative weight
            height: 300,        // Unrealistic height
            age: -5,           // Invalid negative age
            email: 'invalid-email',  // Invalid email format
        };

        // Should validate locally before making API request
        try {
            await updateUserProfile(invalidUpdateData);
        } catch (error) {
            expect(error.message).toContain('validation');
            expect(mockedAxios.put).not.toHaveBeenCalled();
        }
    });

    test('handles concurrent API requests correctly', async () => {
        // Mock different response times
        mockedAxios.get
            .mockImplementationOnce(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: { request: 1 } }), 100)
                )
            )
            .mockImplementationOnce(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: { request: 2 } }), 50)
                )
            )
            .mockImplementationOnce(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: { request: 3 } }), 25)
                )
            );

        // Make concurrent requests
        const promises = [
            getUserProfile(),
            getUserProfile(),
            getUserProfile()
        ];

        const results = await Promise.all(promises);

        // Should handle concurrent requests without race conditions
        expect(results).toHaveLength(3);
        expect(mockedAxios.get).toHaveBeenCalledTimes(3);

        // Results should come back in completion order, not request order
        expect(results[2].request).toBe(3); // Fastest request
        expect(results[1].request).toBe(2); // Medium request
        expect(results[0].request).toBe(1); // Slowest request
    });

    test('API authentication token refresh logic', async () => {
        let tokenRefreshCount = 0;

        // Mock expired token scenario
        mockedAxios.get
            .mockRejectedValueOnce({
                response: { status: 401, data: { detail: 'Token expired' } }
            })
            .mockResolvedValueOnce({
                data: { id: 1, first_name: 'John' }
            });

        // Mock token refresh
        const mockGetIdToken = jest.fn(() => {
            tokenRefreshCount++;
            return Promise.resolve('new-fresh-token');
        });

        jest.mocked(getCurrentUser).mockReturnValue({
            getIdToken: mockGetIdToken
        });

        const result = await getUserProfile();

        // Should automatically refresh token and retry
        expect(tokenRefreshCount).toBe(1);
        expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Original + retry
        expect(result.first_name).toBe('John');
    });

    test('nutrition data aggregation calculations', async () => {
        const mockMealData = {
            data: [
                {
                    id: 1,
                    calories: 250,
                    proteins: 15,
                    carbs: 30,
                    fats: 8,
                    meal_type: 'breakfast'
                },
                {
                    id: 2,
                    calories: 400,
                    proteins: 25,
                    carbs: 45,
                    fats: 12,
                    meal_type: 'lunch'
                },
                {
                    id: 3,
                    calories: null,  // Handle null values
                    proteins: 20,
                    carbs: 35,
                    fats: 10,
                    meal_type: 'dinner'
                }
            ]
        };

        mockedAxios.get.mockResolvedValue(mockMealData);

        const { getNutritionSummary } = require('../../src/api/nutritionApi');
        const summary = await getNutritionSummary();

        // Should calculate totals correctly, handling null values
        expect(summary.total_calories).toBe(650); // 250 + 400 + 0
        expect(summary.total_proteins).toBe(60);  // 15 + 25 + 20
        expect(summary.total_carbs).toBe(110);    // 30 + 45 + 35
        expect(summary.total_fats).toBe(30);      // 8 + 12 + 10

        // Should calculate macro percentages
        const totalCalories = summary.total_calories;
        const proteinCalories = summary.total_proteins * 4;
        const carbCalories = summary.total_carbs * 4;
        const fatCalories = summary.total_fats * 9;

        expect(summary.protein_percentage).toBeCloseTo((proteinCalories / totalCalories) * 100, 1);
        expect(summary.carb_percentage).toBeCloseTo((carbCalories / totalCalories) * 100, 1);
        expect(summary.fat_percentage).toBeCloseTo((fatCalories / totalCalories) * 100, 1);
    });

    test('API response caching mechanism', async () => {
        const cacheKey = '/users/me';
        const mockUserData = {
            data: { id: 1, first_name: 'John', cache_timestamp: Date.now() }
        };

        mockedAxios.get.mockResolvedValue(mockUserData);

        // First request - should hit API
        const result1 = await getUserProfile();
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);

        // Second request within cache time - should use cache
        const result2 = await getUserProfile();
        expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No additional API call
        expect(result2.first_name).toBe('John');

        // Verify cache is working
        expect(result1).toEqual(result2);
    });

    test('handles malformed API responses gracefully', async () => {
        const malformedResponses = [
            { data: null },
            { data: undefined },
            { data: 'not an object' },
            { data: [] }, // Array instead of object
            {}, // Missing data property
        ];

        for (const response of malformedResponses) {
            mockedAxios.get.mockResolvedValueOnce(response);

            try {
                const result = await getUserProfile();

                // Should provide fallback/default data structure
                expect(result).toBeDefined();
                expect(typeof result).toBe('object');

                // Should have default/empty values for required fields
                expect(result.hasOwnProperty('first_name')).toBe(true);
                expect(result.hasOwnProperty('email')).toBe(true);

            } catch (error) {
                // Or should throw descriptive error
                expect(error.message).toContain('Invalid response format');
            }
        }
    });
}); 