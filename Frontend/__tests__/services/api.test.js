import { jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock fetch
global.fetch = jest.fn();

// Import API service
import {
    login,
    register,
    searchFood,
    logMeal,
    getMealHistory,
    updateProfile,
    getProfile,
    logWeight,
    getWeightHistory,
    analyzeImage,
    getAIAdvice,
    getAchievements,
    getDashboardData,
    logout
} from '../../services/api';

describe('API Service', () => {
    const mockToken = 'mock-auth-token';
    const mockResponse = (data, status = 200) => ({
        ok: status < 400,
        status,
        json: jest.fn().mockResolvedValue(data),
        text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        AsyncStorage.getItem.mockResolvedValue(mockToken);
        fetch.mockClear();
    });

    describe('Authentication', () => {
        test('login makes correct API call', async () => {
            const loginData = { email: 'test@example.com', password: 'password123' };
            const responseData = { token: 'new-token', user: { id: 1, email: 'test@example.com' } };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await login(loginData.email, loginData.password);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/login'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify(loginData),
                })
            );

            expect(AsyncStorage.setItem).toHaveBeenCalledWith('userToken', 'new-token');
            expect(result).toEqual(responseData);
        });

        test('register makes correct API call', async () => {
            const registerData = {
                email: 'newuser@example.com',
                password: 'password123',
                firstName: 'John',
                lastName: 'Doe'
            };
            const responseData = { success: true, user: { id: 1 } };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await register(registerData);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/auth/register'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(registerData),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('logout clears stored token', async () => {
            await logout();

            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userToken');
        });

        test('handles authentication errors', async () => {
            fetch.mockResolvedValue(mockResponse({ error: 'Invalid credentials' }, 401));

            await expect(login('wrong@email.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
        });
    });

    describe('Food and Meal Management', () => {
        test('searchFood makes correct API call', async () => {
            const query = 'apple';
            const responseData = [
                { id: 1, name: 'Apple', calories: 95 },
                { id: 2, name: 'Apple Pie', calories: 320 }
            ];

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await searchFood(query);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/food/search?q=${encodeURIComponent(query)}`),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                    }),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('logMeal makes correct API call', async () => {
            const mealData = {
                food_name: 'Apple',
                calories: 95,
                proteins: 0.5,
                carbs: 25,
                fats: 0.3,
                meal_type: 'breakfast',
                serving_qty: 1,
                serving_unit: 'medium'
            };
            const responseData = { id: 1, success: true };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await logMeal(mealData);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/meal_entries/'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify(mealData),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('getMealHistory makes correct API call', async () => {
            const date = '2023-12-01';
            const responseData = [
                { id: 1, food_name: 'Apple', calories: 95, meal_type: 'breakfast' },
                { id: 2, food_name: 'Chicken Salad', calories: 350, meal_type: 'lunch' }
            ];

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await getMealHistory(date);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/meal_entries/${date}`),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                    }),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('getMealHistory without date gets today\'s meals', async () => {
            const today = new Date().toISOString().split('T')[0];
            const responseData = [];

            fetch.mockResolvedValue(mockResponse(responseData));

            await getMealHistory();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/meal_entries/${today}`),
                expect.any(Object)
            );
        });
    });

    describe('Profile Management', () => {
        test('getProfile makes correct API call', async () => {
            const responseData = {
                id: 1,
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                age: 30,
                height: 175,
                weight: 70
            };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await getProfile();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/users/profile'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                    }),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('updateProfile makes correct API call', async () => {
            const profileData = {
                firstName: 'John',
                lastName: 'Smith',
                age: 31,
                height: 175,
                weight: 68
            };
            const responseData = { success: true, ...profileData };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await updateProfile(profileData);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/users/profile'),
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify(profileData),
                })
            );

            expect(result).toEqual(responseData);
        });
    });

    describe('Weight Tracking', () => {
        test('logWeight makes correct API call', async () => {
            const weightData = {
                weight: 70.5,
                notes: 'Morning weight after workout'
            };
            const responseData = { id: 1, success: true };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await logWeight(weightData);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/users/weights'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify(weightData),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('getWeightHistory makes correct API call', async () => {
            const responseData = [
                { id: 1, weight: 70.5, date: '2023-12-01', notes: 'Morning weight' },
                { id: 2, weight: 70.2, date: '2023-12-02', notes: 'After workout' }
            ];

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await getWeightHistory();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/users/weights'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                    }),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('getWeightHistory with date range', async () => {
            const startDate = '2023-11-01';
            const endDate = '2023-11-30';
            const responseData = [];

            fetch.mockResolvedValue(mockResponse(responseData));

            await getWeightHistory(startDate, endDate);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/users/weights?start_date=${startDate}&end_date=${endDate}`),
                expect.any(Object)
            );
        });
    });

    describe('Image Analysis', () => {
        test('analyzeImage makes correct API call', async () => {
            const imageData = 'base64-image-data';
            const responseData = {
                recognized_foods: [
                    {
                        name: 'Apple',
                        confidence: 0.95,
                        nutrition: { calories: 95, proteins: 0.5 }
                    }
                ]
            };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await analyzeImage(imageData);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/image/analyze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({ image: imageData }),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('analyzeImage handles large images', async () => {
            const largeImageData = 'x'.repeat(10000000); // 10MB string

            fetch.mockResolvedValue(mockResponse({ error: 'Image too large' }, 413));

            await expect(analyzeImage(largeImageData)).rejects.toThrow('Image too large');
        });
    });

    describe('AI Integration', () => {
        test('getAIAdvice makes correct API call', async () => {
            const query = 'How can I improve my nutrition?';
            const responseData = {
                advice: 'Consider adding more protein to your breakfast and increasing vegetable intake.',
                source: 'OpenAI GPT'
            };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await getAIAdvice(query);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/gpt/nutrition-advice'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({ query }),
                })
            );

            expect(result).toEqual(responseData);
        });

        test('getAIAdvice with context', async () => {
            const query = 'Meal recommendations';
            const context = {
                recent_meals: ['apple', 'chicken salad'],
                goals: 'weight_loss'
            };

            fetch.mockResolvedValue(mockResponse({ advice: 'Based on your goals...' }));

            await getAIAdvice(query, context);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/gpt/nutrition-advice'),
                expect.objectContaining({
                    body: JSON.stringify({ query, context }),
                })
            );
        });
    });

    describe('Gamification', () => {
        test('getAchievements makes correct API call', async () => {
            const responseData = {
                earned: [
                    { id: 1, name: 'First Meal', description: 'Logged your first meal' }
                ],
                available: [
                    { id: 2, name: 'Week Warrior', description: 'Log meals for 7 days' }
                ]
            };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await getAchievements();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/gamification/achievements'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                    }),
                })
            );

            expect(result).toEqual(responseData);
        });
    });

    describe('Dashboard Data', () => {
        test('getDashboardData makes correct API call', async () => {
            const responseData = {
                daily_calories: { consumed: 1650, target: 2000, remaining: 350 },
                recent_meals: [],
                weight_progress: { current: 70, goal: 65, change: -0.5 },
                achievements: { total_points: 150, level: 3 }
            };

            fetch.mockResolvedValue(mockResponse(responseData));

            const result = await getDashboardData();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/dashboard'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockToken}`,
                    }),
                })
            );

            expect(result).toEqual(responseData);
        });
    });

    describe('Error Handling', () => {
        test('handles network errors', async () => {
            fetch.mockRejectedValue(new Error('Network request failed'));

            await expect(getProfile()).rejects.toThrow('Network request failed');
        });

        test('handles 404 errors', async () => {
            fetch.mockResolvedValue(mockResponse({ error: 'Not found' }, 404));

            await expect(getProfile()).rejects.toThrow('Not found');
        });

        test('handles 500 errors', async () => {
            fetch.mockResolvedValue(mockResponse({ error: 'Internal server error' }, 500));

            await expect(getProfile()).rejects.toThrow('Internal server error');
        });

        test('handles missing token', async () => {
            AsyncStorage.getItem.mockResolvedValue(null);

            await expect(getProfile()).rejects.toThrow('No authentication token found');
        });

        test('handles malformed JSON response', async () => {
            const mockBadResponse = {
                ok: true,
                status: 200,
                json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
                text: jest.fn().mockResolvedValue('Invalid JSON response'),
            };

            fetch.mockResolvedValue(mockBadResponse);

            await expect(getProfile()).rejects.toThrow('Invalid JSON');
        });
    });

    describe('Request Retry Logic', () => {
        test('retries failed requests', async () => {
            // First call fails, second succeeds
            fetch
                .mockResolvedValueOnce(mockResponse({ error: 'Temporary error' }, 500))
                .mockResolvedValueOnce(mockResponse({ success: true }));

            const result = await getProfile();

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ success: true });
        });

        test('gives up after max retries', async () => {
            // All calls fail
            fetch.mockResolvedValue(mockResponse({ error: 'Persistent error' }, 500));

            await expect(getProfile()).rejects.toThrow('Persistent error');

            // Should have tried 3 times (initial + 2 retries)
            expect(fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('Request Caching', () => {
        test('caches profile data', async () => {
            const profileData = { id: 1, name: 'John Doe' };
            fetch.mockResolvedValue(mockResponse(profileData));

            // First call
            const result1 = await getProfile();
            // Second call should use cache
            const result2 = await getProfile();

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual(profileData);
            expect(result2).toEqual(profileData);
        });

        test('cache expires after timeout', async () => {
            jest.useFakeTimers();

            const profileData = { id: 1, name: 'John Doe' };
            fetch.mockResolvedValue(mockResponse(profileData));

            // First call
            await getProfile();

            // Advance time beyond cache timeout
            jest.advanceTimersByTime(300000); // 5 minutes

            // Second call should make new request
            await getProfile();

            expect(fetch).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });
    });
}); 