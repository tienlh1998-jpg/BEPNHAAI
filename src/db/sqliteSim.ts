/**
 * SQLite Simulation Engine
 * Simulates SQLite table operations local to the mobile-first ChefPantry architecture
 * backed by clean disk persistence so data is retained across sessions and test runs.
 */

import fs from 'fs';
import path from 'path';

export interface Ingredient {
  id: number;
  name: string;
  category: 'Meats' | 'Veggies' | 'Condiments' | 'Dry Food' | 'Dairy' | 'Produce';
  quantity: string;
  expiry_date: string; // YYYY-MM-DD
}

export interface Recipe {
  id: number;
  name: string;
  category: 'Family Meals' | 'Pub Mates' | 'Baby Weaning';
  cooking_time_min: number;
  image_url: string;
  instructions: string;
  required_ingredients: string[]; // JSON array of names
  matchPercentage?: number;
  missingItems?: string[];
}

export interface ShoppingItem {
  id: number;
  name: string;
  category: string;
  quantity: string;
  is_checked: boolean;
}

export interface ConsumptionLog {
  id: number;
  ingredient_name: string;
  category: string;
  quantity: string;
  date_consumed: string; // YYYY-MM-DD
}

export interface CookedRecipe {
  id: number;
  recipe_id?: number;
  name: string;
  category: string;
  cooking_time_min: number;
  image_url: string;
  instructions: string;
  ingredientsNeeded: string[];
  cooked_at: string; // YYYY-MM-DD
}

interface Database {
  ingredients: Ingredient[];
  recipes: Recipe[];
  shopping_list: ShoppingItem[];
  consumption_history: ConsumptionLog[];
  cooked_recipes?: CookedRecipe[];
}

const DB_PATH = path.join(process.cwd(), 'src/db/chef_pantry_db.json');

// Helper to get formatted date relative to today
const getRelativeDate = (daysAhead: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
};

const DEFAULT_DB: Database = {
  ingredients: [
    { id: 1, name: 'Whole Milk', category: 'Dairy', quantity: '1 Litre', expiry_date: getRelativeDate(1) },
    { id: 2, name: 'Organic Eggs', category: 'Dairy', quantity: '12pk', expiry_date: getRelativeDate(3) },
    { id: 3, name: 'Baby Spinach', category: 'Produce', quantity: '200g', expiry_date: getRelativeDate(2) },
    { id: 4, name: 'Minced Pork', category: 'Meats', quantity: '500g', expiry_date: getRelativeDate(5) },
    { id: 5, name: 'Firm Tofu', category: 'Condiments', quantity: '400g', expiry_date: getRelativeDate(4) }
  ],
  recipes: [
    {
      id: 1,
      name: 'Herb Roasted Chicken',
      category: 'Family Meals',
      cooking_time_min: 45,
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTjDZOeydLSkYgHnhcLFSwgZz4JE9s0iwl_j8dFUd6NZjzxJlxu-p_kctrIIskBqa2Z1TnPaQaA7xIzJrkdLuNFAMwa_bhPJsWs-MHz6z9-V0vlAnqqnWMR7d0pBbJO-TY7A1gv08f4884OSfnkyztZELnUGZC1PKITVFn92ShLCqqdGWLRgjtnui6EE8KB8GoPz7ElKE83qo8XLXpRpVXSqO0-PiieMNLg9VcgmS0Cb5_Ro6iJeaZHGnWGfjxB9XT5gRpJFzzZAY',
      instructions: '1. Preheat your oven to 200°C.\n2. Season chicken generously with salt, pepper, olive oil, dried herbs, and lemon.\n3. Roast for 45 minutes until juices run clear and skin is beautifully crisp.',
      required_ingredients: ['Whole Milk', 'Organic Eggs', 'Herb Chicken Spice']
    },
    {
      id: 2,
      name: 'Summer Pasta Primavera',
      category: 'Family Meals',
      cooking_time_min: 25,
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAlu0iktLERR0ggXFh27ISwTBq6ihioEOuf1HnpJYSvU9BDKLzWVbrxDWFLZTbiqNvavu3EcscfA_joPNxVV1GMwu4XOgk3HaAEW46kTe_rbYlBPo4zhKmYdTa1PSgOSebpZDQsC-eIa8TM9rr_wEMBRJ75Ufm0H4S8ENUsF12YjVhNVMPAF53kWv-VIwa4SkOR1zs3YkMl-hRqX-vbSLI5MjhAJK7gBYc00U2r2KR5FfsPUjt7-Fua13jr-PcoN9Dvfw_GtpK5MN8',
      instructions: '1. Cook your choice of pasta in salted water.\n2. Sauté baby spinach and fresh garden vegetables in olive oil and minced garlic.\n3. Toss pasta in the vegetables and finish with parmesan and cream.',
      required_ingredients: ['Whole Milk', 'Baby Spinach', 'Firm Tofu', 'Pasta']
    },
    {
      id: 3,
      name: 'Spicy Shakshuka',
      category: 'Family Meals',
      cooking_time_min: 30,
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsdi8GqnD1VT4SlfspkSz40kemJEmiB-wP8ISXJLrg2rm43YqLlcXGY01thvXZKZXxw3u-TzUV7diQ47tx6ubjOacWeeD1IrjdKTPHoOAil_mf4ERlnPQ3ZcAGJjlfFT1hgmjIEVWolu_2bOtQMQHULNAB_GSZISu9UvNcvZqqeyLf01W6eT94Y241X0SRbTvkgpdZsE1JT_Wt4dtVAWsvRKj4sD7Cf9fX0EilYqTMx8DZfZ_5eraxtKgwV49bUxrN0d_85EMlOSI',
      instructions: '1. Heat olive oil and sauté onions, bell peppers, garlic and spices.\n2. Pour in canned crushed tomatoes and let simmer for 10 minutes.\n3. Crack eggs directly into the sauce and cook until whites set.',
      required_ingredients: ['Organic Eggs', 'Tomatoes', 'Bell Peppers', 'Spicy Paste']
    },
    // Adding Pub Mates Examples
    {
      id: 4,
      name: 'Sautéed Garlic Beef with Chillies',
      category: 'Pub Mates',
      cooking_time_min: 15,
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=60',
      instructions: '1. Sauté sliced beef with heavy garlic and red hot chillies.\n2. Add oyster sauce and splash some domestic lager.\n3. Serve immediate with fresh celery.',
      required_ingredients: ['Beef Chuck', 'Garlic', 'Chillies', 'Glaze']
    },
    {
      id: 5,
      name: 'Crispy Garlic Tofu Wings',
      category: 'Pub Mates',
      cooking_time_min: 20,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60',
      instructions: '1. Press and dry firm tofu, then cut into small wing shapes.\n2. Dredge in cornstarch and fry till extra crispy.\n3. Toss in sriracha glaze and sesame.',
      required_ingredients: ['Firm Tofu', 'Cornstarch', 'Sriracha', 'Scallions']
    },
    {
      id: 6,
      name: 'Cháo Lòng Đỏ Trứng Và Bí Đỏ',
      category: 'Baby Weaning',
      cooking_time_min: 20,
      image_url: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=600&auto=format&fit=crop&q=80',
      instructions: '1. Ninh gạo tẻ với nước cho chín nhừ thành cháo sánh mịn.\n2. Bí đỏ gọt vỏ, thái lát mỏng rồi hấp chín nhuyễn.\n3. Rây mịn bí đỏ rồi khuấy cùng nồi cháo đang sôi.\n4. Đánh tan lòng đỏ Trứng Gà Ta/Eggs rồi rây từ từ vào cháo, quấy đều tay 3 phút cho chín thơm.',
      required_ingredients: ['Organic Eggs', 'Bí đỏ']
    },
    {
      id: 7,
      name: 'Súp Nhuyễn Khoai Tây Sữa Láng Mịn',
      category: 'Baby Weaning',
      cooking_time_min: 15,
      image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&auto=format&fit=crop&q=80',
      instructions: '1. Khoai tây gọt vỏ sạch, hấp cách thủy cho chín mềm thơm phức.\n2. Dùng thìa hoặc mát nghiền nghiền thật mịn khoai tây.\n3. Đổ sữa tươi Whole Milk ấm vào phần khoai nghiền khuấy đều cho sánh nhuyễn.\n4. Rây lại hỗn hợp một lần nữa qua lưới lọc để súp láng mịn.',
      required_ingredients: ['Whole Milk', 'Khoai tây']
    },
    {
      id: 8,
      name: 'Bột Heo Xay Nhuyễn Rau Chân Vịt',
      category: 'Baby Weaning',
      cooking_time_min: 25,
      image_url: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=600&auto=format&fit=crop&q=80',
      instructions: '1. Thịt heo dăm băm nhuyễn mịn rồi xay kỹ cùng chút nước cho tan tơi.\n2. Rau chân vịt luộc chín ráo nước rồi xay nhuyễn vắt nước lọc bã mịn.\n3. Nấu bột gạo chín mềm sánh, trút thịt heo vào quấy liên tục 5 phút cho chín kỹ.\n4. Cho nước cốt rau chân vịt vào sau cùng khuấy sủi tăm đều rồi tắt bếp dọn cho bé ăn hâm nóng.',
      required_ingredients: ['Minced Pork', 'Baby Spinach', 'Bột gạo']
    }
  ],
  shopping_list: [
    { id: 1, name: 'Organic Brown Eggs (12pk)', category: 'Staple', quantity: '1 unit', is_checked: true },
    { id: 2, name: 'Firm Tofu (400g)', category: 'Staple', quantity: '1 unit', is_checked: true },
    { id: 3, name: 'Minced Pork (500g)', category: 'Protein', quantity: '1 unit', is_checked: true },
    { id: 4, name: 'Frozen Beef Chuck (1kg)', category: 'Freezer', quantity: '1 unit', is_checked: true },
    { id: 5, name: 'Smokey BBQ Sauce (Bottle)', category: 'Staple', quantity: '1 unit', is_checked: true },
    { id: 6, name: 'Russet Potatoes (2kg bag)', category: 'Produce', quantity: '1 unit', is_checked: true }
  ],
  consumption_history: [
    { id: 1, ingredient_name: 'Thịt Ba Rọi Heo', category: 'Meats', quantity: '500g', date_consumed: getRelativeDate(-6) },
    { id: 2, ingredient_name: 'Rau Muống Sạch', category: 'Veggies', quantity: '300g', date_consumed: getRelativeDate(-6) },
    { id: 3, ingredient_name: 'Whole Milk', category: 'Dairy', quantity: '1 Litre', date_consumed: getRelativeDate(-5) },
    { id: 4, ingredient_name: 'Cà Rốt Đà Lạt', category: 'Veggies', quantity: '2 củ', date_consumed: getRelativeDate(-5) },
    { id: 5, ingredient_name: 'Phile Cá Hồi Na Uy', category: 'Meats', quantity: '300g', date_consumed: getRelativeDate(-4) },
    { id: 6, ingredient_name: 'Firm Tofu', category: 'Condiments', quantity: '400g', date_consumed: getRelativeDate(-4) },
    { id: 7, ingredient_name: 'Organic Eggs', category: 'Dairy', quantity: '4 quả', date_consumed: getRelativeDate(-3) },
    { id: 8, ingredient_name: 'Nấm Đông Cô Tươi', category: 'Veggies', quantity: '150g', date_consumed: getRelativeDate(-3) },
    { id: 9, ingredient_name: 'Thịt Bò Cắt Lát', category: 'Meats', quantity: '400g', date_consumed: getRelativeDate(-2) },
    { id: 10, ingredient_name: 'Baby Spinach', category: 'Veggies', quantity: '200g', date_consumed: getRelativeDate(-2) },
    { id: 11, ingredient_name: 'Rau Muống Sạch', category: 'Veggies', quantity: '250g', date_consumed: getRelativeDate(-1) },
    { id: 12, ingredient_name: 'Organic Eggs', category: 'Dairy', quantity: '6 quả', date_consumed: getRelativeDate(-1) },
    { id: 13, ingredient_name: 'Thịt Ba Rọi Heo', category: 'Meats', quantity: '450g', date_consumed: getRelativeDate(0) },
    { id: 14, ingredient_name: 'Firm Tofu', category: 'Condiments', quantity: '200g', date_consumed: getRelativeDate(0) }
  ],
  cooked_recipes: [
    {
      id: 1,
      recipe_id: 1,
      name: 'Herb Roasted Chicken',
      category: 'Family Meals',
      cooking_time_min: 45,
      image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTjDZOeydLSkYgHnhcLFSwgZz4JE9s0iwl_j8dFUd6NZjzxJlxu-p_kctrIIskBqa2Z1TnPaQaA7xIzJrkdLuNFAMwa_bhPJsWs-MHz6z9-V0vlAnqqnWMR7d0pBbJO-TY7A1gv08f4884OSfnkyztZELnUGZC1PKITVFn92ShLCqqdGWLRgjtnui6EE8KB8GoPz7ElKE83qo8XLXpRpVXSqO0-PiieMNLg9VcgmS0Cb5_Ro6iJeaZHGnWGfjxB9XT5gRpJFzzZAY',
      instructions: '1. Preheat your oven to 200°C.\n2. Season chicken generously with salt, pepper, olive oil, dried herbs, and lemon.\n3. Roast for 45 minutes until juices run clear and skin is beautifully crisp.',
      ingredientsNeeded: ['Whole Milk', 'Organic Eggs', 'Herb Chicken Spice'],
      cooked_at: getRelativeDate(-2)
    },
    {
      id: 2,
      recipe_id: 4,
      name: 'Sautéed Garlic Beef with Chillies',
      category: 'Pub Mates',
      cooking_time_min: 15,
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=60',
      instructions: '1. Sauté sliced beef with heavy garlic and red hot chillies.\n2. Add oyster sauce and splash some domestic lager.\n3. Serve immediate with fresh celery.',
      ingredientsNeeded: ['Beef Chuck', 'Garlic', 'Chillies', 'Glaze'],
      cooked_at: getRelativeDate(-1)
    },
    {
      id: 3,
      recipe_id: 6,
      name: 'Cháo Lòng Đỏ Trứng Và Bí Đỏ',
      category: 'Baby Weaning',
      cooking_time_min: 20,
      image_url: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=600&auto=format&fit=crop&q=80',
      instructions: '1. Ninh gạo tẻ với nước cho chín nhừ thành cháo sánh mịn.\n2. Bí đỏ gọt vỏ, thái lát mỏng rồi hấp chín nhuyễn.\n3. Rây mịn bí đỏ rồi khuấy cùng nồi cháo đang sôi.\n4. Đánh tan lòng đỏ Trứng Gà Ta/Eggs rồi rây từ từ vào cháo, quấy đều tay 3 phút cho chín thơm.',
      ingredientsNeeded: ['Organic Eggs', 'Bí đỏ'],
      cooked_at: getRelativeDate(0)
    }
  ]
};

// Initialize the Database
export function initDB(): Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    return DEFAULT_DB;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading Sim DB, resetting...', err);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
    return DEFAULT_DB;
  }
}

function writeDB(data: Database) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving Sim DB:', err);
  }
}

// 1. Ingredients Queries & mutations
export function queryIngredients(): Ingredient[] {
  const db = initDB();
  return db.ingredients;
}

export function saveIngredient(name: string, category: Ingredient['category'], quantity: string, expiry_date: string): Ingredient {
  const db = initDB();
  const nextId = db.ingredients.length > 0 ? Math.max(...db.ingredients.map(i => i.id)) + 1 : 1;
  const newItem: Ingredient = { id: nextId, name, category, quantity, expiry_date };
  db.ingredients.push(newItem);
  writeDB(db);
  return newItem;
}

export function removeIngredient(id: number): boolean {
  const db = initDB();
  const index = db.ingredients.findIndex(i => i.id === id);
  if (index !== -1) {
    db.ingredients.splice(index, 1);
    writeDB(db);
    return true;
  }
  return false;
}

// 2. Recipe Queries & mutations
export function queryRecipes(categoryFilter?: Recipe['category']): Recipe[] {
  const db = initDB();
  let list = db.recipes;
  if (categoryFilter) {
    list = list.filter(r => r.category === categoryFilter);
  }
  return list;
}

export function saveRecipe(name: string, category: Recipe['category'], cooking_time_min: number, image_url: string, instructions: string, required_ingredients: string[]): Recipe {
  const db = initDB();
  const nextId = db.recipes.length > 0 ? Math.max(...db.recipes.map(r => r.id)) + 1 : 1;
  const newRecipe: Recipe = { id: nextId, name, category, cooking_time_min, image_url, instructions, required_ingredients };
  db.recipes.push(newRecipe);
  writeDB(db);
  return newRecipe;
}

// 3. Shopping List Queries & mutations
export function queryShoppingList(): ShoppingItem[] {
  const db = initDB();
  return db.shopping_list;
}

export function addShoppingItem(name: string, category: string, quantity: string, is_checked: boolean = false): ShoppingItem {
  const db = initDB();
  const nextId = db.shopping_list.length > 0 ? Math.max(...db.shopping_list.map(s => s.id)) + 1 : 1;
  const newItem: ShoppingItem = { id: nextId, name, category, quantity, is_checked };
  db.shopping_list.push(newItem);
  writeDB(db);
  return newItem;
}

export function toggleShoppingItem(id: number, checked: boolean): ShoppingItem | null {
  const db = initDB();
  const item = db.shopping_list.find(s => s.id === id);
  if (item) {
    item.is_checked = checked;
    writeDB(db);
    return item;
  }
  return null;
}

export function clearShoppingList(): void {
  const db = initDB();
  db.shopping_list = [];
  writeDB(db);
}

export function addManyToShoppingList(items: { name: string, category: string, quantity: string }[]): ShoppingItem[] {
  const db = initDB();
  const added: ShoppingItem[] = [];
  let nextId = db.shopping_list.length > 0 ? Math.max(...db.shopping_list.map(s => s.id)) + 1 : 1;

  for (const it of items) {
    // Check if duplicate unchecked item exists
    const existing = db.shopping_list.find(s => s.name.toLowerCase() === it.name.toLowerCase());
    if (existing) {
      existing.is_checked = false; // reset check state
      added.push(existing);
    } else {
      const newItem: ShoppingItem = { id: nextId++, name: it.name, category: it.category, quantity: it.quantity, is_checked: false };
      db.shopping_list.push(newItem);
      added.push(newItem);
    }
  }

  writeDB(db);
  return added;
}

export function queryConsumptionHistory(): ConsumptionLog[] {
  const db = initDB();
  return db.consumption_history || [];
}

export function addConsumptionLog(name: string, category: string, quantity: string, dateStr?: string): ConsumptionLog {
  const db = initDB();
  if (!db.consumption_history) {
    db.consumption_history = [];
  }
  const nextId = db.consumption_history.length > 0 ? Math.max(...db.consumption_history.map(c => c.id)) + 1 : 1;
  const date = dateStr || new Date().toISOString().split('T')[0];
  const newLog: ConsumptionLog = {
    id: nextId,
    ingredient_name: name,
    category: category,
    quantity: quantity,
    date_consumed: date
  };
  db.consumption_history.push(newLog);
  writeDB(db);
  return newLog;
}

export function queryCookedRecipes(): CookedRecipe[] {
  const db = initDB();
  if (!db.cooked_recipes) {
    db.cooked_recipes = [];
  }
  return db.cooked_recipes;
}

export function saveCookedRecipe(
  recipeName: string,
  category: string,
  cookingTimeMin: number,
  imageUrl: string,
  instructions: string,
  ingredientsNeeded: string[],
  recipeId?: number
): CookedRecipe {
  const db = initDB();
  if (!db.cooked_recipes) {
    db.cooked_recipes = [];
  }
  const nextId = db.cooked_recipes.length > 0 ? Math.max(...db.cooked_recipes.map(c => c.id)) + 1 : 1;
  const newCooked: CookedRecipe = {
    id: nextId,
    recipe_id: recipeId,
    name: recipeName,
    category: category,
    cooking_time_min: cookingTimeMin,
    image_url: imageUrl,
    instructions: instructions,
    ingredientsNeeded: ingredientsNeeded,
    cooked_at: new Date().toISOString().split('T')[0]
  };
  db.cooked_recipes.push(newCooked);
  writeDB(db);
  return newCooked;
}

export function deleteCookedRecipe(id: number): boolean {
  const db = initDB();
  if (!db.cooked_recipes) {
    db.cooked_recipes = [];
  }
  const initialLength = db.cooked_recipes.length;
  db.cooked_recipes = db.cooked_recipes.filter(r => r.id !== id);
  if (db.cooked_recipes.length !== initialLength) {
    writeDB(db);
    return true;
  }
  return false;
}

export function clearCookedRecipes(): boolean {
  const db = initDB();
  db.cooked_recipes = [];
  writeDB(db);
  return true;
}

