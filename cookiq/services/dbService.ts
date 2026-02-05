
import { RecipeSet, StoredRecipeSet } from "../types";

const DB_KEY = "cookiq_history_v1";

export const dbService = {
  saveRecipeSet: (recipeSet: RecipeSet): StoredRecipeSet => {
    const history = dbService.getAll();
    const newEntry: StoredRecipeSet = {
      ...recipeSet,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    // Keep only the last 20 recipes to avoid filling up local storage
    const updatedHistory = [newEntry, ...history].slice(0, 20);
    localStorage.setItem(DB_KEY, JSON.stringify(updatedHistory));
    return newEntry;
  },

  getAll: (): StoredRecipeSet[] => {
    const data = localStorage.getItem(DB_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse history", e);
      return [];
    }
  },

  delete: (id: string) => {
    const history = dbService.getAll();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(filtered));
  },

  clearAll: () => {
    localStorage.removeItem(DB_KEY);
  }
};
