#!/usr/bin/env python3
"""
Script to fix incomplete FoodLog constructors in test files.
Adds all required fields with default values.
"""

import re
import os

def get_complete_foodlog_template():
    """Return a template for complete FoodLog constructor"""
    return """FoodLog(
            user_id={user_id},
            meal_id={meal_id},
            food_name="{food_name}",
            calories={calories},
            proteins={proteins},
            carbs={carbs},
            fats={fats},
            fiber={fiber},
            sugar={sugar},
            saturated_fat={saturated_fat},
            polyunsaturated_fat={polyunsaturated_fat},
            monounsaturated_fat={monounsaturated_fat},
            trans_fat={trans_fat},
            cholesterol={cholesterol},
            sodium={sodium},
            potassium={potassium},
            vitamin_a={vitamin_a},
            vitamin_c={vitamin_c},
            calcium={calcium},
            iron={iron},
            weight={weight},
            weight_unit="{weight_unit}",
            image_url="{image_url}",
            file_key="{file_key}",
            healthiness_rating={healthiness_rating},
            meal_type="{meal_type}"
        )"""

def extract_foodlog_params(match_text):
    """Extract parameters from existing FoodLog constructor"""
    defaults = {
        'user_id': 'authenticated_user.id',
        'meal_id': '1',
        'food_name': 'Test Food',
        'calories': '100',
        'proteins': '5',
        'carbs': '15',
        'fats': '3',
        'fiber': '2',
        'sugar': '5',
        'saturated_fat': '1',
        'polyunsaturated_fat': '1',
        'monounsaturated_fat': '1',
        'trans_fat': '0',
        'cholesterol': '0',
        'sodium': '50',
        'potassium': '100',
        'vitamin_a': '10',
        'vitamin_c': '5',
        'calcium': '15',
        'iron': '1',
        'weight': '100.0',
        'weight_unit': 'g',
        'image_url': 'test.jpg',
        'file_key': 'test_key',
        'healthiness_rating': '7',
        'meal_type': 'breakfast'
    }
    
    # Extract existing values
    for param in defaults.keys():
        pattern = rf'{param}=([^,\n)]+)'
        match = re.search(pattern, match_text)
        if match:
            value = match.group(1).strip()
            if not value.startswith('"') and param in ['food_name', 'weight_unit', 'image_url', 'file_key', 'meal_type']:
                value = f'"{value}"'
            defaults[param] = value
    
    return defaults

def fix_foodlog_constructors(file_path):
    """Fix FoodLog constructors in a file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Pattern to match FoodLog constructors
    pattern = r'FoodLog\(\s*\n(.*?)\s*\)'
    
    def replace_foodlog(match):
        params = extract_foodlog_params(match.group(0))
        template = get_complete_foodlog_template()
        return template.format(**params)
    
    # Replace all FoodLog constructors
    new_content = re.sub(pattern, replace_foodlog, content, flags=re.DOTALL)
    
    # Write back
    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print(f"Fixed FoodLog constructors in {file_path}")

def main():
    test_files = [
        'tests/api/test_meal_entries.py',
        'tests/services/test_gamification_service.py'
    ]
    
    for file_path in test_files:
        if os.path.exists(file_path):
            fix_foodlog_constructors(file_path)
        else:
            print(f"File not found: {file_path}")

if __name__ == "__main__":
    main() 