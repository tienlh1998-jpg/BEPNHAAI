/**
 * CORE LOGIC FUNCTION: Culinary Recipe Matcher powered by Gemini AI
 * Leverages @google/genai SDK to generate 3 custom localized recipes
 * based on the ingredients currently remaining in the user's pantry.
 */

import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini SDK lazily to avoid crashes if GEMINI_API_KEY is not set immediately
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

export interface GeneratedRecipe {
  recipeName: string;
  category: 'Cơm nhà' | 'Món nhậu' | 'Ăn dặm cho bé';
  cookingTimeMin: number;
  matchPercentage: number;
  description: string;
  instructions: string;
  ingredientsNeeded: string[];
  missingIngredients: string[];
}

export interface MatcherResponse {
  recipes: GeneratedRecipe[];
}

/**
 * Matches existing ingredients to exactly 3 distinct localized recipes
 * @param availableIngredients List of strings representing ingredients in the fridge
 * @returns Promise containing 3 structured recipes
 */
export async function matchRecipesWithGemini(availableIngredients: string[], category?: string): Promise<MatcherResponse> {
  const ai = getGeminiClient();

  let restrictionPrompt = "";
  if (category) {
    restrictionPrompt = `Please match, design, and formulate EXACTLY 3 distinct, creative, and delicious recipes ALL belonging specifically to the category "${category}".
    For each recipe, ensure the 'category' field in the returning JSON is exactly "${category}".`;
    if (category === "Ăn dặm cho bé") {
      restrictionPrompt += ` Use baby-friendly items (such as eggs, spinach, tofu, milk, rice, pumpkin, carrot, minced meat, etc). Ensure they are soft, safe, highly digestible, non-spicy, healthy baby or toddler weaning foods. Only use ingredients appropriate for infants (no chili, extreme spices, or alcohol).`;
    } else if (category === "Món nhậu") {
      restrictionPrompt += ` Make them savory, crispy, salty, spicy, pan-fried, or roasted, perfect as pub bites or party food with beverages.`;
    } else if (category === "Cơm nhà") {
      restrictionPrompt += ` Make them classic comforting Vietnamese home-cooked dishes enjoyed with warm rice (canh, món mặn, món xào).`;
    }
  } else {
    restrictionPrompt = `Please match, design, and formulate EXACTLY 3 recipes corresponding to each of these 3 specific categories (1 recipe per category):
    1. "Cơm nhà" (Family Meals): Comforting, highly nutrient-dense home meals.
    2. "Món nhậu" (Pub Mates / Mồi bén): Tasty, crisp, salty or spicy dishes perfect with a light local drink or juice.
    3. "Ăn dặm cho bé" (Baby Weaning): Soft, safe, non-spicy, healthy purees, soft mashes, or baby cereal options.`;
  }

  const prompt = `
    You are a professional Michelin-star Vietnamese Chef and Sous-chef. 
    The user has the following ingredients currently available in their refrigerator:
    [${availableIngredients.join(", ")}]

    ${restrictionPrompt}

    Guidelines for composition:
    - Attempt to maximize the usage of the available ingredients.
    - Set the matchPercentage based on how many available ingredients cover the recipe's requirements (e.g. if 3/4 are available, it's 75%).
    - Be creative but realistic! The recipes should run in actual kitchens.
    - CRITICAL: ALL ingredient names in the "ingredientsNeeded" and "missingIngredients" arrays MUST be returned in Vietnamese (Tiếng Việt) so that they are easy to read and understand (e.g., use "Tỏi", "Trứng gà ta", "Rau chân vịt", "Hành lá", "Nước mắm", "Dầu ăn", etc.). Do NOT leave them in English.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      recipes: {
        type: Type.ARRAY,
        description: "Must contain exactly 3 objects matching the requested criteria",
        items: {
          type: Type.OBJECT,
          properties: {
            recipeName: {
              type: Type.STRING,
              description: "Creative Vietnamese name with elegant cooking phrasing (e.g., Đậu Hũ Nhồi Thịt Sốt Cà hoặc Cháo Lòng Đỏ Bí Đỏ)"
            },
            category: {
              type: Type.STRING,
              description: "Must be exactly one of: 'Cơm nhà', 'Món nhậu', 'Ăn dặm cho bé'"
            },
            cookingTimeMin: {
              type: Type.INTEGER,
              description: "Cooking time in minutes"
            },
            matchPercentage: {
              type: Type.INTEGER,
              description: "How well ingredients match (0 - 100)"
            },
            description: {
              type: Type.STRING,
              description: "A 1-2 sentence appetizing description of the dish"
            },
            instructions: {
              type: Type.STRING,
              description: "Numbered cooking instructions separated by newlines"
            },
            ingredientsNeeded: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "All ingredients required for this dish"
            },
            missingIngredients: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Ingredients that are required but NOT in the provided available list"
            }
          },
          required: [
            "recipeName",
            "category",
            "cookingTimeMin",
            "matchPercentage",
            "description",
            "instructions",
            "ingredientsNeeded",
            "missingIngredients"
          ]
        }
      }
    },
    required: ["recipes"]
  };

  try {
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Gemini] Attempting generation with model ${model} (attempt ${attempt}/2)...`);
          response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              systemInstruction: "You are an expert chef assistant producing precise JSON outputs for recipe matches.",
              responseMimeType: "application/json",
              responseSchema: responseSchema
            }
          });
          break; // break attempt loop on success
        } catch (err: any) {
          lastError = err;
          console.warn(`[Gemini] Model ${model} on attempt ${attempt} failed:`, err.message || err);
          if (model !== modelsToTry[modelsToTry.length - 1] || attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
      }
      if (response) break; // break models loop on success
    }

    if (!response) {
      throw lastError || new Error("Failed to generate recipe match with any available models.");
    }

    const textOutput = response.text || "{}";
    const result: MatcherResponse = JSON.parse(textOutput);
    return result;

  } catch (error) {
    console.error("Gemini Recipe Matcher failed, falling back to local heuristic matching:", error);
    // Fallback Mock data in case API key is missing or encounters a rate-limit or temporary overload
    return getFallbackRecipes(availableIngredients, category);
  }
}

function getFallbackRecipes(availableIngredients: string[], category?: string): MatcherResponse {
  // Graceful fallback to guarantee smooth running even without online API connectivity
  const normalized = availableIngredients.map(i => i.toLowerCase());
  const hasEggs = normalized.some(i => i.includes('egg') || i.includes('trứng'));
  const hasSpinach = normalized.some(i => i.includes('spinach') || i.includes('cải') || i.includes('rau'));
  const hasTofu = normalized.some(i => i.includes('tofu') || i.includes('đậu'));
  const hasPork = normalized.some(i => i.includes('pork') || i.includes('thịt'));

  if (category === "Ăn dặm cho bé") {
    return {
      recipes: [
        {
          recipeName: "Cháo Lòng Đỏ Trứng Và Bí Đỏ",
          category: "Ăn dặm cho bé",
          cookingTimeMin: 20,
          matchPercentage: hasEggs ? 90 : 50,
          description: "Cháo bổ sung folate, sắt và vitamin A từ cá rùa chín mịn cho bé tập nhai.",
          instructions: "1. Ninh gạo tẻ sánh mịn.\n2. Bí đỏ hấp rây nhuyễn trộn cùng cháo.\n3. Quấy lòng đỏ trứng tan sủi chín nhẹ trước khi cho bé dùng.",
          ingredientsNeeded: ["Trứng gà ta", "Bí đỏ", "Gạo tẻ"],
          missingIngredients: hasEggs ? ["Bí đỏ", "Gạo tẻ"] : ["Trứng gà ta", "Bí đỏ", "Gạo tẻ"]
        },
        {
          recipeName: "Súp Nhuyễn Khoai Tây Sữa Láng Mịn",
          category: "Ăn dặm cho bé",
          cookingTimeMin: 15,
          matchPercentage: 70,
          description: "Súp nhuyễn giàu canxi từ sữa Whole Milk mềm mại lướt dịu êm đầu lưỡi bé.",
          instructions: "1. Hấp chín bở khoai tây thơm phức.\n2. Rây thật nhỏ mịn mượt rồi trộn sữa tươi ấm.\n3. Đun nhẹ 1 phút rồi bưng phục vụ bé ăn hâm nhẹ.",
          ingredientsNeeded: ["Sữa tươi sạch", "Khoai tây"],
          missingIngredients: ["Sữa tươi sạch", "Khoai tây"]
        },
        {
          recipeName: "Bột Thịt Heo Xay Nhuyễn Rau Chân Vịt",
          category: "Ăn dặm cho bé",
          cookingTimeMin: 25,
          matchPercentage: hasPork && hasSpinach ? 100 : 70,
          description: "Món dặm bột gạo dồi dào sắt từ thịt heo nạc và đọt rau chân vịt thanh mát.",
          instructions: "1. Thịt heo dăm băm nhuyễn mịn tao nước cho tơi rã sền sệt.\n2. Rau chân vịt luộc băm nhỏ lọc mịn.\n3. Nấu cháo rây rồi bổ sung thịt, rau, quấy đều sôi tắt bếp ấm nồng.",
          ingredientsNeeded: ["Thịt heo băm", "Cải bó xôi", "Bột gạo"],
          missingIngredients: hasPork && hasSpinach ? ["Bột gạo"] : ["Thịt heo băm", "Cải bó xôi", "Bột gạo"].filter(x => x !== "Minced Pork" && x !== "Baby Spinach")
        }
      ]
    };
  }

  if (category === "Món nhậu") {
    return {
      recipes: [
        {
          recipeName: "Đậu Hũ Chiên Giòn Tẩm Muối Sả",
          category: "Món nhậu",
          cookingTimeMin: 15,
          matchPercentage: hasTofu ? 95 : 60,
          description: "Đậu chiên giòn ngoài, mướt trong xóc cùng hành sả khô phi mằn mặn hấp dẫn.",
          instructions: "1. Đậu hũ thấm ráo nước cắt chiên vàng bốc hơi sả.\n2. Xóc muối ớt khô giòn.",
          ingredientsNeeded: ["Đậu hũ non", "Sả", "Ớt"],
          missingIngredients: hasTofu ? ["Sả", "Ớt"] : ["Đậu hũ non", "Sả", "Ớt"]
        },
        {
          recipeName: "Sườn Nướng Muối Ớt Chua Cay",
          category: "Món nhậu",
          cookingTimeMin: 35,
          matchPercentage: 50,
          description: "Sườn chặt tảng khò vàng tẩm xốt sả mật ong nướng giòn.",
          instructions: "1. Ướp sườn với sả bằm và ớt hiểm.\n2. Nướng lò nướng 180 độ 30 phút vàng cháy cạnh.",
          ingredientsNeeded: ["Sườn heo", "Sả", "Ớt", "Mật ong"],
          missingIngredients: ["Sườn heo", "Sả", "Ớt", "Mật ong"]
        },
        {
          recipeName: "Thịt Heo Sốt Sả Ớt Cay Nồng",
          category: "Món nhậu",
          cookingTimeMin: 20,
          matchPercentage: hasPork ? 85 : 40,
          description: "Thịt heo xào xém cạnh dậy mùi hành sả cay nhắm đưa bia mồi bén cực chất.",
          instructions: "1. Thịt heo thái lát mỏng vừa ăn xào săn.\n2. Trút sả bằm hành phi vàng ươm vào đảo khô thơm lừng.",
          ingredientsNeeded: ["Thịt heo băm", "Sả", "Ớt"],
          missingIngredients: hasPork ? ["Sả", "Ớt"] : ["Thịt heo băm", "Sả", "Ớt"]
        }
      ]
    };
  }

  // Otherwise, default/com_nha category combinations
  return {
    recipes: [
      {
        recipeName: hasPork && hasTofu ? "Đậu Hũ Sốt Thịt Bằm" : "Canh Trứng Cà Chua Ấm Áp",
        category: "Cơm nhà",
        cookingTimeMin: 20,
        matchPercentage: hasTofu && hasPork ? 100 : 90,
        description: "Món cơm ấm áp, dễ làm, dồi dào dinh dưỡng cho cả gia đình.",
        instructions: "1. Đầu tiên, xào thơm hành khô băm nhỏ.\n2. Cho thêm thịt heo bằm xào chín săn chắc.\n3. Cho sốt cà chua và đậu hũ trắng cắt miếng vuông nhỏ rưới bốc hơi.\n4. Nêm gia vị vừa ăn rồi bày ra đĩa rắc hành hoa.",
        ingredientsNeeded: ["Đậu hũ non", "Thịt heo băm", "Cà chua", "Hành hoa"],
        missingIngredients: hasTofu && hasPork ? ["Cà chua"] : ["Cà chua", "Hành hoa"]
      },
      {
        recipeName: hasTofu ? "Đậu Hũ Chiên Giòn Tẩm Muối Sả" : "Thịt Ba Chỉ Nướng Sả Ớt",
        category: "Món nhậu",
        cookingTimeMin: 15,
        matchPercentage: hasTofu ? 95 : 70,
        description: "Món nhắm thơm nồng, giòn rụm bên ngoài nhưng mọng nước bên trong.",
        instructions: "1. Đậu hũ thấm thật ráo nước, cắt miếng vuông vừa ăn.\n2. Lăn qua một lớp bột bắp mỏng nhẹ.\n3. Thả đậu hũ vào chảo dầu nóng chiên vàng đều đóng nắp.\n4. Rang sả ớt băm nhuyễn với chút muối rồi xóc đều cùng đậu hũ.",
        ingredientsNeeded: ["Đậu hũ non", "Sả", "Ớt", "Bột bắp"],
        missingIngredients: ["Sả", "Ớt"]
      },
      {
        recipeName: hasEggs && hasSpinach ? "Cháo Nhuyễn Trứng Gà Rau Chân Vịt" : "Sữa Đậu Nành Nguyên Chất Cho Bé",
        category: "Ăn dặm cho bé",
        cookingTimeMin: 25,
        matchPercentage: hasEggs && hasSpinach ? 100 : 80,
        description: "Cháo mềm mịn xốp, cực kỳ dễ tiêu hóa giúp bé ăn mau chóng lớn.",
        instructions: "1. Ninh gạo tẻ cho nở nhuyễn sánh mịn.\n2. Rau chân vịt luộc chín xay thật mịn nhuyễn lọc xơ.\n3. Đập lòng đỏ trứng gà ta đánh tan tơi xốp.\n4. Cho lòng đỏ trứng và rau vào nồi cháo đang sôi khuấy đều tay 3 phút.",
        ingredientsNeeded: ["Trứng gà ta", "Cải bó xôi", "Gạo tẻ"],
        missingIngredients: ["Gạo tẻ"]
      }
    ]
  };
}
