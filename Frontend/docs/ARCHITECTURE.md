# PlateMate Frontend Architecture

## 📁 Organized File Structure

```
Frontend/
├── src/
│   ├── api/                    # External API integrations
│   │   ├── nutritionix.ts      # Nutritionix API client
│   │   └── fatSecret.ts        # FatSecret API client
│   │
│   ├── services/               # Business logic layer
│   │   └── BarcodeService.ts   # Centralized barcode scanning logic
│   │
│   ├── components/             # Reusable UI components
│   │   └── charts/
│   │       └── NutritionCharts.tsx  # Chart components
│   │
│   ├── screens/                # Application screens
│   │   ├── BarcodeScanner.tsx  # Barcode scanning interface
│   │   └── BarcodeResults.tsx  # Results display screen
│   │
│   ├── utils/                  # Utility functions
│   │   ├── database.ts         # SQLite operations
│   │   └── config.ts           # App configuration
│   │
│   └── types/                  # TypeScript type definitions
└── docs/                       # Documentation
    └── ARCHITECTURE.md         # This file
```

## 🏗️ Architecture Patterns

### 1. Service Layer Pattern
**File:** `src/services/BarcodeService.ts`

```typescript
// Centralized business logic
export class BarcodeService {
    // Singleton pattern for consistent access
    public static getInstance(): BarcodeService

    // Primary method with intelligent fallback
    public async lookupBarcode(barcode: string): Promise<FoodItem | null>

    // Validation and utility methods
    public validateScanResult(result: any): boolean
    public getSupportedBarcodeTypes(): string[]
}
```

**Benefits:**
- ✅ Single responsibility principle
- ✅ Centralized error handling
- ✅ Easy testing and mocking
- ✅ Consistent API across the app

### 2. Component Composition Pattern
**File:** `src/components/charts/NutritionCharts.tsx`

```typescript
// Modular chart components
export const MacronutrientPieChart: React.FC<Props>
export const MacronutrientProgress: React.FC<Props>
export const NutritionLegend: React.FC<Props>
export const AdditionalNutrients: React.FC<Props>

// Consistent color scheme
export const NUTRITION_COLORS = { ... }
```

**Benefits:**
- ✅ Reusable across screens
- ✅ Consistent styling
- ✅ Easier maintenance
- ✅ Better testing isolation

### 3. API Abstraction Pattern
**Files:** `src/api/nutritionix.ts`, `src/api/fatSecret.ts`

```typescript
// Consistent interface for different APIs
export const fetchFoodByBarcode = async (barcode: string): Promise<FoodItem | null>

// Standardized data format
export interface FoodItem {
    food_name: string;
    brand_name?: string;
    calories: number;
    // ... standardized nutrition fields
}
```

**Benefits:**
- ✅ Vendor-agnostic data format
- ✅ Easy API switching
- ✅ Consistent error handling
- ✅ Type safety

## 🔄 Data Flow

```
User Scans Barcode
       ↓
BarcodeScanner.tsx
       ↓
BarcodeService.lookupBarcode()
       ↓
┌─ Nutritionix API (Primary)
├─ FatSecret API (Fallback)
└─ Return FoodItem | null
       ↓
BarcodeResults.tsx
       ↓
NutritionCharts Components
       ↓
Database Storage
```

## 🎯 Design Principles

### 1. **Separation of Concerns**
- **UI Layer**: Screens handle user interaction only
- **Service Layer**: Business logic and API orchestration
- **API Layer**: External service communication
- **Component Layer**: Reusable UI elements

### 2. **Dependency Injection**
```typescript
// Bad: Direct API calls in components
const foodData = await fetchFromNutritionix(barcode);

// Good: Service abstraction
const foodData = await barcodeService.lookupBarcode(barcode);
```

### 3. **Single Source of Truth**
- Colors defined in `NUTRITION_COLORS`
- Barcode types managed by `BarcodeService`
- API credentials in `config.ts`

### 4. **Error Boundary Pattern**
```typescript
// Service handles all error scenarios
try {
    return await this.tryNutritionix(barcode);
} catch (error) {
    return await this.tryFatSecret(barcode);
}
```

## 📊 Component Architecture

### Chart Components Hierarchy
```
NutritionCharts.tsx
├── MacronutrientPieChart     # Overview pie chart
├── MacronutrientProgress     # Individual progress circles
├── NutritionLegend          # Color-coded legend
└── AdditionalNutrients      # Fiber, sugar, sodium display
```

### Props Interface Design
```typescript
interface NutritionData {
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber?: number;    // Optional nutrients
    sugar?: number;
    sodium?: number;
}
```

## 🔧 Configuration Management

### Environment Variables
```typescript
// src/utils/config.ts
// API credentials moved to backend for security
export const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
```

### Feature Flags
```typescript
export const FATSECRET_ENABLED = true;
export const NUTRITIONIX_ENABLED = true;
```

## 🧪 Testing Strategy

### Unit Tests
- **BarcodeService**: API fallback logic
- **NutritionCharts**: Component rendering
- **API modules**: Data transformation

### Integration Tests
- **Barcode flow**: Scanner → Service → Results
- **Chart integration**: Data → Visualization
- **Database operations**: Save → Retrieve

### E2E Tests
- **Happy path**: Successful barcode scan
- **Error handling**: Invalid barcode, network failure
- **UI interactions**: Quantity changes, meal selection

## 🚀 Performance Optimizations

### 1. **Lazy Loading**
```typescript
// Charts only load when needed
const NutritionCharts = React.lazy(() => import('./components/charts/NutritionCharts'));
```

### 2. **Memoization**
```typescript
// Expensive calculations cached
const chartData = useMemo(() => calculateChartData(foodData), [foodData]);
```

### 3. **API Caching**
```typescript
// Service-level caching for repeated requests
private cache = new Map<string, FoodItem>();
```

## 📈 Scalability Considerations

### 1. **New API Integration**
To add a new nutrition API:
1. Create new API client in `src/api/`
2. Add to `BarcodeService.lookupBarcode()` fallback chain
3. Update type definitions if needed

### 2. **Chart Extensions**
To add new chart types:
1. Create component in `src/components/charts/`
2. Export from `NutritionCharts.tsx`
3. Use consistent `NUTRITION_COLORS`

### 3. **Feature Modules**
Future features can follow the same pattern:
```
src/
├── services/RecipeService.ts
├── components/recipe/RecipeCards.tsx
└── screens/RecipeBuilder.tsx
```

## 🔐 Security Best Practices

### API Key Management
- ✅ Stored in configuration file
- ✅ Not committed to git (use .env)
- ✅ Server-side proxy recommended for production

### Data Validation
- ✅ Input sanitization in `BarcodeService`
- ✅ Type checking with TypeScript
- ✅ Runtime validation for API responses

## 📚 Documentation Standards

### Code Comments
```typescript
/**
 * Primary barcode lookup with intelligent fallback
 * @param barcode - The scanned barcode
 * @returns Promise<FoodItem | null>
 */
public async lookupBarcode(barcode: string): Promise<FoodItem | null>
```

### Component Documentation
```typescript
/**
 * Macronutrient Pie Chart Component
 * Displays calorie distribution across carbs, protein, and fat
 */
export const MacronutrientPieChart: React.FC<Props>
```

This architecture provides a solid foundation for the nutrition tracking app with clear separation of concerns, reusable components, and excellent maintainability. 