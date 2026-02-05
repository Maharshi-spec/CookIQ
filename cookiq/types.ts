
export interface RecipeSource {
  uri: string;
  title: string;
}

export interface Ingredient {
  item: string;
  amount: string;
}

export interface NutritionFacts {
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
}

export interface IngredientCategorization {
  edible: string[];
  wildOrUnsafe?: string[];
  nonFood?: string[];
  toxic?: string[];
}

export interface Recipe {
  dishName: string;
  cookingTime: string;
  dishType: 'Vegetarian' | 'Non-Vegetarian';
  ingredients: Ingredient[];
  steps: string[];
  nutrition: NutritionFacts;
}

export interface RecipeSet {
  analysis: {
    categorization: IngredientCategorization;
    safetyAlerts?: string[];
  };
  recipes: Recipe[];
  sources?: RecipeSource[];
}

export interface StoredRecipeSet extends RecipeSet {
  id: string;
  timestamp: number;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RESULT = 'RESULT',
  ERROR = 'ERROR',
  HISTORY = 'HISTORY'
}
