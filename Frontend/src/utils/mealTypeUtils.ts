export const getDefaultMealType = (): 'Breakfast' | 'Lunch' | 'Dinner' => {
  const hour = new Date().getHours();

  // Breakfast between 4:00 (inclusive) and 11:00 (exclusive)
  if (hour >= 4 && hour < 11) {
    return 'Breakfast';
  }

  // Lunch between 11:00 (inclusive) and 17:00 (exclusive)
  if (hour >= 11 && hour < 17) {
    return 'Lunch';
  }

  // Dinner for all other times (17:00 – 3:59)
  return 'Dinner';
}; 