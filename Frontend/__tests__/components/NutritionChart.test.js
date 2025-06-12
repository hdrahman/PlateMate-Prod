import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';

// Mock react-native-chart-kit
jest.mock('react-native-chart-kit', () => ({
    PieChart: 'PieChart',
    LineChart: 'LineChart',
    BarChart: 'BarChart',
}));

// Import components to test
import NutritionChart from '../../components/NutritionChart';
import MacroBreakdown from '../../components/MacroBreakdown';
import CalorieProgress from '../../components/CalorieProgress';
import WeeklyTrends from '../../components/WeeklyTrends';

describe('NutritionChart', () => {
    const mockNutritionData = {
        calories: 1800,
        proteins: 120,
        carbs: 180,
        fats: 60,
        fiber: 25,
        sugar: 45,
    };

    test('renders nutrition chart with correct data', () => {
        render(<NutritionChart data={mockNutritionData} />);

        expect(screen.getByText('Nutrition Overview')).toBeTruthy();
        expect(screen.getByText('1800')).toBeTruthy(); // calories
        expect(screen.getByText('120g')).toBeTruthy(); // proteins
        expect(screen.getByText('180g')).toBeTruthy(); // carbs
        expect(screen.getByText('60g')).toBeTruthy(); // fats
    });

    test('calculates and displays accurate daily value percentages', () => {
        render(<NutritionChart data={mockNutritionData} dailyCalorieGoal={2000} />);

        // Test actual percentage calculations
        const caloriesPercentage = Math.round((1800 / 2000) * 100);
        expect(screen.getByText(`${caloriesPercentage}%`)).toBeTruthy();
        expect(caloriesPercentage).toBe(90); // Verify the calculation is correct

        // Test fiber percentage (assuming 25g daily value)
        const fiberPercentage = Math.round((25 / 25) * 100);
        expect(screen.getByText(`${fiberPercentage}%`)).toBeTruthy();
        expect(fiberPercentage).toBe(100);
    });

    test('handles edge cases in nutrition data', () => {
        const edgeCaseData = {
            calories: 0,
            proteins: null,
            carbs: undefined,
            fats: -5, // Invalid negative value
            fiber: 1000, // Extremely high value
            sugar: 0.1, // Very small decimal
        };

        render(<NutritionChart data={edgeCaseData} />);

        // Should handle null/undefined gracefully
        expect(screen.getByText('0')).toBeTruthy(); // calories
        expect(screen.getByText('0g')).toBeTruthy(); // proteins should default to 0
        expect(screen.getByText('0g')).toBeTruthy(); // carbs should default to 0

        // Should handle negative values (either reject or convert to 0)
        const fatDisplay = screen.queryByText('-5g');
        expect(fatDisplay).toBeFalsy(); // Should not display negative
    });

    test('validates chart data visualization accuracy', () => {
        const { getByTestId } = render(<NutritionChart data={mockNutritionData} showChart={true} />);

        const chartElement = getByTestId('nutrition-chart');

        // Verify chart receives correct data structure
        expect(chartElement.props.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Proteins',
                    value: 120,
                    color: expect.any(String)
                }),
                expect.objectContaining({
                    name: 'Carbs',
                    value: 180,
                    color: expect.any(String)
                }),
                expect.objectContaining({
                    name: 'Fats',
                    value: 60,
                    color: expect.any(String)
                })
            ])
        );
    });

    test('responds correctly to user interactions', () => {
        const mockOnMacroPress = jest.fn();
        render(
            <NutritionChart
                data={mockNutritionData}
                onMacroPress={mockOnMacroPress}
                interactive={true}
            />
        );

        // Test protein section interaction
        const proteinSection = screen.getByTestId('protein-section');
        fireEvent.press(proteinSection);

        expect(mockOnMacroPress).toHaveBeenCalledWith('proteins', 120);

        // Test carbs section interaction
        const carbsSection = screen.getByTestId('carbs-section');
        fireEvent.press(carbsSection);

        expect(mockOnMacroPress).toHaveBeenCalledWith('carbs', 180);
    });

    test('handles empty or null data gracefully without crashing', () => {
        const testCases = [null, undefined, {}, { calories: null }];

        testCases.forEach(testData => {
            const { unmount } = render(<NutritionChart data={testData} />);

            // Should render without crashing
            expect(screen.getByText('No nutrition data available')).toBeTruthy();

            unmount(); // Clean up for next test case
        });
    });

    test('validates accessibility features', () => {
        render(<NutritionChart data={mockNutritionData} />);

        // Check for accessibility labels
        expect(screen.getByLabelText('Calories consumed: 1800')).toBeTruthy();
        expect(screen.getByLabelText('Protein consumed: 120 grams')).toBeTruthy();
        expect(screen.getByLabelText('Carbohydrates consumed: 180 grams')).toBeTruthy();
        expect(screen.getByLabelText('Fats consumed: 60 grams')).toBeTruthy();
    });

    test('toggles between different chart views with correct data', () => {
        render(<NutritionChart data={mockNutritionData} showToggle={true} />);

        const toggleButton = screen.getByText('Switch View');

        // Initially should show bar chart
        expect(screen.getByTestId('bar-chart')).toBeTruthy();

        fireEvent.press(toggleButton);

        // Should switch to pie chart with same data
        expect(screen.getByTestId('pie-chart')).toBeTruthy();
        expect(screen.queryByTestId('bar-chart')).toBeFalsy();

        // Verify data consistency across views
        const pieChart = screen.getByTestId('pie-chart');
        expect(pieChart.props.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ value: 120 }), // proteins
                expect.objectContaining({ value: 180 }), // carbs  
                expect.objectContaining({ value: 60 })   // fats
            ])
        );
    });

    test('updates chart when data props change', () => {
        const initialData = { calories: 1000, proteins: 50, carbs: 100, fats: 30 };
        const updatedData = { calories: 2000, proteins: 100, carbs: 200, fats: 60 };

        const { rerender } = render(<NutritionChart data={initialData} />);

        // Verify initial data
        expect(screen.getByText('1000')).toBeTruthy();
        expect(screen.getByText('50g')).toBeTruthy();

        // Update props and verify changes
        rerender(<NutritionChart data={updatedData} />);

        expect(screen.getByText('2000')).toBeTruthy();
        expect(screen.getByText('100g')).toBeTruthy();
        expect(screen.queryByText('1000')).toBeFalsy();
        expect(screen.queryByText('50g')).toBeFalsy();
    });
});

describe('MacroBreakdown', () => {
    const mockMacros = {
        proteins: 120, // 480 calories
        carbs: 180,    // 720 calories  
        fats: 60,      // 540 calories
    };

    test('renders macro breakdown correctly', () => {
        render(<MacroBreakdown macros={mockMacros} />);

        expect(screen.getByText('Macronutrient Breakdown')).toBeTruthy();
        expect(screen.getByText('Proteins')).toBeTruthy();
        expect(screen.getByText('Carbohydrates')).toBeTruthy();
        expect(screen.getByText('Fats')).toBeTruthy();
    });

    test('calculates macro percentages correctly', () => {
        render(<MacroBreakdown macros={mockMacros} />);

        const totalCalories = (120 * 4) + (180 * 4) + (60 * 9); // 1740
        const proteinPercentage = Math.round((480 / totalCalories) * 100);
        const carbPercentage = Math.round((720 / totalCalories) * 100);
        const fatPercentage = Math.round((540 / totalCalories) * 100);

        expect(screen.getByText(`${proteinPercentage}%`)).toBeTruthy();
        expect(screen.getByText(`${carbPercentage}%`)).toBeTruthy();
        expect(screen.getByText(`${fatPercentage}%`)).toBeTruthy();
    });

    test('displays macro gram amounts', () => {
        render(<MacroBreakdown macros={mockMacros} />);

        expect(screen.getByText('120g')).toBeTruthy(); // proteins
        expect(screen.getByText('180g')).toBeTruthy(); // carbs
        expect(screen.getByText('60g')).toBeTruthy();  // fats
    });

    test('shows ideal macro ranges', () => {
        render(<MacroBreakdown macros={mockMacros} showIdealRanges={true} />);

        expect(screen.getByText('Ideal: 10-35%')).toBeTruthy(); // protein range
        expect(screen.getByText('Ideal: 45-65%')).toBeTruthy(); // carb range
        expect(screen.getByText('Ideal: 20-35%')).toBeTruthy(); // fat range
    });

    test('highlights macros outside ideal ranges', () => {
        const extremeMacros = {
            proteins: 200, // Very high
            carbs: 50,     // Very low
            fats: 100,     // High
        };

        render(<MacroBreakdown macros={extremeMacros} showIdealRanges={true} />);

        // Should show warning indicators for out-of-range macros
        expect(screen.getByTestId('protein-warning')).toBeTruthy();
        expect(screen.getByTestId('carb-warning')).toBeTruthy();
        expect(screen.getByTestId('fat-warning')).toBeTruthy();
    });
});

describe('CalorieProgress', () => {
    const mockCalorieData = {
        consumed: 1650,
        target: 2000,
        burned: 350,
    };

    test('renders calorie progress correctly', () => {
        render(<CalorieProgress data={mockCalorieData} />);

        expect(screen.getByText('Daily Calories')).toBeTruthy();
        expect(screen.getByText('1650')).toBeTruthy(); // consumed
        expect(screen.getByText('2000')).toBeTruthy(); // target
        expect(screen.getByText('350')).toBeTruthy();  // burned
    });

    test('calculates net calories correctly', () => {
        render(<CalorieProgress data={mockCalorieData} />);

        const netCalories = mockCalorieData.consumed - mockCalorieData.burned;
        expect(screen.getByText(`${netCalories}`)).toBeTruthy(); // 1300
    });

    test('shows remaining calories to goal', () => {
        render(<CalorieProgress data={mockCalorieData} />);

        const remaining = mockCalorieData.target - mockCalorieData.consumed;
        expect(screen.getByText(`${remaining} remaining`)).toBeTruthy(); // 350 remaining
    });

    test('handles exceeded calorie goal', () => {
        const exceededData = {
            consumed: 2200,
            target: 2000,
            burned: 0,
        };

        render(<CalorieProgress data={exceededData} />);

        expect(screen.getByText('200 over')).toBeTruthy();
        expect(screen.getByTestId('over-goal-indicator')).toBeTruthy();
    });

    test('shows progress bar with correct percentage', () => {
        render(<CalorieProgress data={mockCalorieData} />);

        const progressPercentage = (mockCalorieData.consumed / mockCalorieData.target) * 100;
        const progressBar = screen.getByTestId('progress-bar');

        expect(progressBar.props.style).toContainEqual(
            expect.objectContaining({ width: `${progressPercentage}%` })
        );
    });

    test('displays different colors based on progress', () => {
        // Test normal progress (green)
        render(<CalorieProgress data={mockCalorieData} />);
        let progressBar = screen.getByTestId('progress-bar');
        expect(progressBar.props.style).toContainEqual(
            expect.objectContaining({ backgroundColor: '#4CAF50' })
        );

        // Test near goal (yellow)
        const nearGoalData = { consumed: 1900, target: 2000, burned: 0 };
        render(<CalorieProgress data={nearGoalData} />);
        progressBar = screen.getByTestId('progress-bar');
        expect(progressBar.props.style).toContainEqual(
            expect.objectContaining({ backgroundColor: '#FF9800' })
        );

        // Test over goal (red)
        const overGoalData = { consumed: 2100, target: 2000, burned: 0 };
        render(<CalorieProgress data={overGoalData} />);
        progressBar = screen.getByTestId('progress-bar');
        expect(progressBar.props.style).toContainEqual(
            expect.objectContaining({ backgroundColor: '#F44336' })
        );
    });
});

describe('WeeklyTrends', () => {
    const mockWeeklyData = [
        { date: '2023-12-01', calories: 1800, weight: 70.2 },
        { date: '2023-12-02', calories: 1950, weight: 70.1 },
        { date: '2023-12-03', calories: 1750, weight: 70.0 },
        { date: '2023-12-04', calories: 2100, weight: 70.3 },
        { date: '2023-12-05', calories: 1900, weight: 70.1 },
        { date: '2023-12-06', calories: 1850, weight: 69.9 },
        { date: '2023-12-07', calories: 2000, weight: 70.0 },
    ];

    test('renders weekly trends chart', () => {
        render(<WeeklyTrends data={mockWeeklyData} />);

        expect(screen.getByText('Weekly Trends')).toBeTruthy();
        expect(screen.getByTestId('line-chart')).toBeTruthy();
    });

    test('toggles between different metrics', () => {
        render(<WeeklyTrends data={mockWeeklyData} />);

        const caloriesTab = screen.getByText('Calories');
        const weightTab = screen.getByText('Weight');

        // Start with calories view
        expect(caloriesTab.props.style).toContainEqual(
            expect.objectContaining({ backgroundColor: expect.any(String) })
        );

        // Switch to weight view
        fireEvent.press(weightTab);
        expect(weightTab.props.style).toContainEqual(
            expect.objectContaining({ backgroundColor: expect.any(String) })
        );
    });

    test('calculates weekly averages', () => {
        render(<WeeklyTrends data={mockWeeklyData} />);

        const avgCalories = mockWeeklyData.reduce((sum, day) => sum + day.calories, 0) / 7;
        const avgWeight = mockWeeklyData.reduce((sum, day) => sum + day.weight, 0) / 7;

        expect(screen.getByText(`Avg: ${Math.round(avgCalories)}`)).toBeTruthy();

        // Switch to weight view to see weight average
        fireEvent.press(screen.getByText('Weight'));
        expect(screen.getByText(`Avg: ${avgWeight.toFixed(1)}kg`)).toBeTruthy();
    });

    test('shows trend indicators', () => {
        render(<WeeklyTrends data={mockWeeklyData} />);

        // Should show trend indicator (up/down arrow)
        expect(screen.getByTestId('trend-indicator')).toBeTruthy();
    });

    test('handles insufficient data gracefully', () => {
        const insufficientData = [
            { date: '2023-12-01', calories: 1800, weight: 70.2 },
        ];

        render(<WeeklyTrends data={insufficientData} />);

        expect(screen.getByText('Insufficient data for trends')).toBeTruthy();
    });

    test('formats dates correctly on chart', () => {
        render(<WeeklyTrends data={mockWeeklyData} />);

        // Should show abbreviated day names
        expect(screen.getByText('Fri')).toBeTruthy(); // Dec 1, 2023 was Friday
        expect(screen.getByText('Sat')).toBeTruthy();
        expect(screen.getByText('Sun')).toBeTruthy();
    });

    test('shows data point values on tap', () => {
        render(<WeeklyTrends data={mockWeeklyData} />);

        const chartArea = screen.getByTestId('line-chart');
        fireEvent.press(chartArea);

        // Should show tooltip with data point value
        expect(screen.getByTestId('data-tooltip')).toBeTruthy();
    });
});

describe('NutritionGoals', () => {
    const mockGoals = {
        calories: { target: 2000, current: 1650 },
        protein: { target: 150, current: 120 },
        carbs: { target: 250, current: 180 },
        fats: { target: 65, current: 60 },
        fiber: { target: 25, current: 18 },
    };

    test('renders nutrition goals correctly', () => {
        render(<NutritionGoals goals={mockGoals} />);

        expect(screen.getByText('Daily Goals')).toBeTruthy();
        expect(screen.getByText('Calories')).toBeTruthy();
        expect(screen.getByText('Protein')).toBeTruthy();
        expect(screen.getByText('Carbs')).toBeTruthy();
        expect(screen.getByText('Fats')).toBeTruthy();
        expect(screen.getByText('Fiber')).toBeTruthy();
    });

    test('shows progress percentage for each goal', () => {
        render(<NutritionGoals goals={mockGoals} />);

        const calorieProgress = Math.round((1650 / 2000) * 100);
        const proteinProgress = Math.round((120 / 150) * 100);

        expect(screen.getByText(`${calorieProgress}%`)).toBeTruthy();
        expect(screen.getByText(`${proteinProgress}%`)).toBeTruthy();
    });

    test('highlights completed goals', () => {
        const completedGoals = {
            calories: { target: 2000, current: 2000 },
            protein: { target: 150, current: 155 },
        };

        render(<NutritionGoals goals={completedGoals} />);

        expect(screen.getByTestId('calories-completed')).toBeTruthy();
        expect(screen.getByTestId('protein-completed')).toBeTruthy();
    });

    test('allows editing goals', () => {
        const mockOnGoalEdit = jest.fn();

        render(<NutritionGoals goals={mockGoals} onGoalEdit={mockOnGoalEdit} />);

        const editButton = screen.getByTestId('edit-calories-goal');
        fireEvent.press(editButton);

        expect(mockOnGoalEdit).toHaveBeenCalledWith('calories', 2000);
    });
}); 