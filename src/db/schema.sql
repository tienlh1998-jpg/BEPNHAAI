-- ====================================================================
-- CHEFPANTRY OFFLINE-FIRST SQLite SCHEMA
-- Perfect for local/mobile applications with offline capability
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. Table: ingredients (Bảng Nguyên liệu)
-- Tracks items currently in the fridge/pantry with critical expiration alerts.
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Meats', 'Veggies', 'Condiments', 'Dry Food', 'Dairy', 'Produce')),
    quantity TEXT NOT NULL,                -- e.g., '12pk', '400g', '500g', '2kg bag'
    weight_g INTEGER DEFAULT 0,            -- Approximate weight in grams for sorting
    expiry_date DATE NOT NULL,             -- Expiry date in YYYY-MM-DD format
    added_date DATE DEFAULT (DATE('now')), -- Date when added to the tracking system
    is_low BOOLEAN DEFAULT 0               -- Status toggle for UI quick checks
);

-- 2. Table: recipes (Bảng Món ăn)
-- Stores curated and AI-matched dishes with category tagging.
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK(category IN ('Family Meals', 'Pub Mates', 'Baby Weaning')),
    cooking_time_min INTEGER NOT NULL,     -- Cooking duration in minutes
    image_url TEXT,                         -- ChefPantry premium image asset link
    instructions TEXT NOT NULL,            -- Multi-step preparation instructions
    required_ingredients TEXT NOT NULL     -- JSON array string of required items with quantity
);

-- 3. Table: shopping_list (Bảng Danh sách đi chợ)
-- Offline-first grocery list with check states and item categories
CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',-- Category grouping (Produce, Staple, Protein, etc.)
    quantity TEXT NOT NULL DEFAULT '1',     -- Package counts or unit amounts
    is_checked INTEGER NOT NULL DEFAULT 0,  -- Boolean (0 = unchecked, 1 = checked)
    recipe_id INTEGER,                      -- Reference to recipe triggering this shopping list item
    FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);

-- Index optimizations for quick local lookups on mobile devices
CREATE INDEX IF NOT EXISTS idx_ingredients_expiry ON ingredients(expiry_date);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_shopping_checked ON shopping_list(is_checked);

-- ====================================================================
-- Initial Seed Data: Matching the ChefPantry App screenshots
-- ====================================================================

-- Seed Ingredients (Match screenshot 1 and 3)
INSERT INTO ingredients (id, name, category, quantity, expiry_date) VALUES 
(1, 'Whole Milk', 'Dairy', '1 Litre', DATE('now', '+1 day')),
(2, 'Organic Eggs', 'Dairy', '12pk', DATE('now', '+3 days')),
(3, 'Baby Spinach', 'Produce', '200g', DATE('now', '+2 days')),
(4, 'Minced Pork', 'Meats', '500g', DATE('now', '+5 days')),
(5, 'Firm Tofu', 'Condiments', '400g', DATE('now', '+4 days')),
(6, 'Herb Roasted Chicken', 'Meats', '1kg', DATE('now', '+6 days'));

-- Seed Curated Recipes (Match screenshot 2)
INSERT INTO recipes (id, name, category, cooking_time_min, image_url, instructions, required_ingredients) VALUES 
(1, 'Herb Roasted Chicken', 'Family Meals', 45, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTjDZOeydLSkYgHnhcLFSwgZz4JE9s0iwl_j8dFUd6NZjzxJlxu-p_kctrIIskBqa2Z1TnPaQaA7xIzJrkdLuNFAMwa_bhPJsWs-MHz6z9-V0vlAnqqnWMR7d0pBbJO-TY7A1gv08f4884OSfnkyztZELnUGZC1PKITVFn92ShLCqqdGWLRgjtnui6EE8KB8GoPz7ElKE83qo8XLXpRpVXSqO0-PiieMNLg9VcgmS0Cb5_Ro6iJeaZHGnWGfjxB9XT5gRpJFzzZAY', '1. Preheat your oven to 200°C.\n2. Season chicken generously with salt, pepper, olive oil, and chopped fresh rosemary and thyme.\n3. Roast for 45 minutes until the skin is beautifully golden-brown and juices run clear.', '["Chicken (1kg)", "Rosemary", "Thyme", "Garlic"]'),
(2, 'Summer Pasta Primavera', 'Family Meals', 25, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAlu0iktLERR0ggXFh27ISwTBq6ihioEOuf1HnpJYSvU9BDKLzWVbrxDWFLZTbiqNvavu3EcscfA_joPNxVV1GMwu4XOgk3HaAEW46kTe_rbYlBPo4zhKmYdTa1PSgOSebpZDQsC-eIa8TM9rr_wEMBRJ75Ufm0H4S8ENUsF12YjVhNVMPAF53kWv-VIwa4SkOR1zs3YkMl-hRqX-vbSLI5MjhAJK7gBYc00U2r2KR5FfsPUjt7-Fua13jr-PcoN9Dvfw_GtpK5MN8', '1. Boil pasta in salted water.\n2. Sauté cherry tomatoes, bell peppers, zucchini, and baby spinach in olive oil.\n3. Toss pasta with the sautéed vegetables, garlic, and fresh parmesan cheese.', '["Pasta", "Cherry Tomatoes", "Zucchini", "Baby Spinach"]'),
(3, 'Spicy Shakshuka', 'Family Meals', 30, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsdi8GqnD1VT4SlfspkSz40kemJEmiB-wP8ISXJLrg2rm43YqLlcXGY01thvXZKZXxw3u-TzUV7diQ47tx6ubjOacWeeD1IrjdKTPHoOAil_mf4ERlnPQ3ZcAGJjlfFT1hgmjIEVWolu_2bOtQMQHULNAB_GSZISu9UvNcvZqqeyLf01W6eT94Y241X0SRbTvkgpdZsE1JT_Wt4dtVAWsvRKj4sD7Cf9fX0EilYqTMx8DZfZ_5eraxtKgwV49bUxrN0d_85EMlOSI', '1. Heat olive oil in a skillet and sauté chopped onions, bell peppers, and garlic.\n2. Add crushed tomatoes, cumin, paprika, and chili flakes; simmer for 10 minutes.\n3. Crack eggs directly into the tomato sauce, cover, and cook until whites are set but yolks remain runny.', '["Eggs", "Canned Tomatoes", "Bell Pepper", "Cumin", "Chili flakes"]');

-- Seed Shopping List (Match screenshot 1)
INSERT INTO shopping_list (id, name, category, quantity, is_checked) VALUES 
(1, 'Organic Brown Eggs (12pk)', 'Staple', '1 unit', 1),
(2, 'Firm Tofu (400g)', 'Produce', '1 unit', 1),
(3, 'Minced Pork (500g)', 'Protein', '1 unit', 1),
(4, 'Frozen Beef Chuck (1kg)', 'Freezer', '1 unit', 1),
(5, 'Smokey BBQ Sauce (Bottle)', 'Staple', '1 unit', 1),
(6, 'Russet Potatoes (2kg bag)', 'Produce', '1 unit', 1);
