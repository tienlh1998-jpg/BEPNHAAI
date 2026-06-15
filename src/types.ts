export interface Ingredient {
  id: number;
  name: string;
  category: 'Meats' | 'Veggies' | 'Condiments' | 'Dry Food' | 'Dairy' | 'Produce';
  quantity: string;
  expiry_date: string;
}

export interface ExpiryAlert {
  id: number;
  name: string;
  category: string;
  quantity: string;
  expiry_date: string;
  daysRemaining: number;
  alertText: string;
}

export interface FridgeStatus {
  percentage: number;
  emptyPercentage: number;
  breakdown: {
    meats: number;
    veggies: number;
    condiments: number;
    dryFood: number;
  };
}

export interface DashboardResponse {
  success: boolean;
  fridgeStatus: FridgeStatus;
  expiryAlerts: ExpiryAlert[];
  ingredientsCount: number;
}

export interface Recipe {
  id: number;
  name: string;
  category: 'Cơm nhà' | 'Món nhậu' | 'Ăn dặm cho bé';
  cooking_time_min: number;
  image_url: string;
  instructions: string;
  ingredientsNeeded: string[];
  missingIngredients: string[];
  description?: string;
  matchPercentage?: number;
  cooked_at?: string;
  cook_count?: number;
}

export interface ShoppingItem {
  id: number;
  name: string;
  category: string;
  quantity: string;
  is_checked: boolean;
}
