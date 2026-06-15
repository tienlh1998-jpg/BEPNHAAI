// Bilingual English-to-Vietnamese translation utility for standard shelf ingredients
const TRANSLATION_MAP: Record<string, string> = {
  // Meats & Proteins
  "organic eggs": "Trứng gà ta",
  "eggs": "Trứng gà",
  "egg": "Trứng gà",
  "minced pork": "Thịt heo băm",
  "pork ribs": "Sườn heo",
  "pork rib": "Sườn heo",
  "beef chuck": "Bắp bò tươi",
  "beef": "Thịt bò",
  "pork": "Thịt heo",
  "chicken": "Thịt gà",
  "cod fish": "Cá tuyết",
  "salmon": "Cá hồi",
  "crab": "Cua biển",
  "shrimp": "Tôm tươi",
  "shrimps": "Tôm tươi",
  "fish": "Cá tươi",
  
  // Veggies, Fruits & Greens
  "baby spinach": "Cải bó xôi",
  "spinach": "Cải bó xôi (Rau chân vịt)",
  "garlic": "Tỏi",
  "chili": "Ớt tươi",
  "chillies": "Ớt tươi",
  "tomatoes": "Cà chua",
  "tomato": "Cà chua",
  "bell peppers": "Ớt chuông",
  "bell pepper": "Ớt chuông",
  "scallions": "Hành lá",
  "scallion": "Hành lá",
  "onions": "Hành tây",
  "onion": "Hành tây",
  "ginger": "Gừng tươi",
  "cilantro": "Rau mùi",
  "cucumber": "Dưa chuột",
  "potatoes": "Khoai tây",
  "potato": "Khoai tây",
  "carrots": "Cà rốt Đà Lạt",
  "carrot": "Cà rốt Đà Lạt",
  "cabbage": "Bắp cải",
  "lime": "Chanh quả",
  "lemongrass": "Sả củ",
  "mushrooms": "Nấm",
  "mushroom": "Nấm",
  "bok choy": "Cải thìa",
  "pumpkin": "Bí đỏ",
  "basil": "Rau húng quế",
  
  // Dry Food, Grains & Noodles
  "pasta": "Mỳ Ý (Pasta)",
  "rice": "Gạo tẻ",
  "nudel": "Mì sợi",
  
  // Pantry & Condiments
  "fish sauce": "Nước mắm",
  "sugar": "Đường cát",
  "black pepper": "Tiêu đen xay",
  "pepper": "Tiêu đen",
  "cooking oil": "Dầu ăn",
  "soy sauce": "Nước tương",
  "salt": "Muối ăn",
  "spicy paste": "Sa tế cay",
  "sriracha": "Tương ớt Sriracha",
  "oyster sauce": "Dầu hào",
  "cornstarch": "Bột bắp",
  "honey": "Mật ong",
  "lemon": "Chanh vàng",
  
  // Dairy & Liquids
  "whole milk": "Sữa tươi sạch",
  "milk": "Sữa tươi",
  "yogurt": "Sữa chua",
  "firm tofu": "Đậu hũ non",
  "tofu": "Đậu hũ",
  
  // Custom Fallback items
  "herb chicken spice": "Gia vị thảo mộc ướp gà",
  "bột gạo": "Bột gạo",
  "bí đỏ": "Bí đỏ",
  "khoai tây": "Khoai tây"
};

/**
 * Cleanly translates any English ingredient or food name into standard Vietnamese
 */
export function translateIngredientName(name: string): string {
  if (!name) return "";
  
  const cleaned = name.toLowerCase().trim();
  
  // Check if it already matches perfectly
  if (TRANSLATION_MAP[cleaned]) {
    return TRANSLATION_MAP[cleaned];
  }
  
  // Find longest matching prefix/substring to avoid wrong replacements
  const sortedKeys = Object.keys(TRANSLATION_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (cleaned === key || cleaned.includes(key)) {
      return TRANSLATION_MAP[key];
    }
  }
  
  // Fallback to original, capitalizing first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}
