/**
 * CORE LOGIC FUNCTION: AI Ingredient Substitutes Powered by Gemini AI
 * Suggests smart replacements for missing ingredients in a recipe,
 * focusing on items currently available in the user's fridge first, 
 * or common alternatives in Vietnamese cuisine.
 */

import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
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

export interface SubstituteOption {
  name: string;
  description: string;
  isInFridge: boolean;
}

export interface IngredientSubstitute {
  missingIngredient: string;
  substitutes: SubstituteOption[];
}

export interface SuggestSubstitutesResponse {
  suggestions: IngredientSubstitute[];
}

/**
 * Generates smart substitutions using Gemini AI, with a robust local fallback.
 */
export async function suggestSubstitutesWithGemini(
  recipeName: string,
  missingIngredients: string[],
  fridgeIngredients: string[]
): Promise<SuggestSubstitutesResponse> {
  if (!missingIngredients || missingIngredients.length === 0) {
    return { suggestions: [] };
  }

  const prompt = `
    You are an expert Vietnamese Culinary Advisor and Michelin Star Sous-Chef in Bếp Nhà AI.
    The user wants to cook the recipe: "${recipeName}".
    However, they are missing the following ingredients:
    [${missingIngredients.join(", ")}]

    Here is the list of ingredients currently available in their refrigerator:
    [${fridgeIngredients.join(", ")}]

    Please suggest smart, delicious, and common ingredient substitutions (1 to 3 alternate options per missing ingredient) to save the dish.
    If possible, recommend items that are ALREADY in their refrigerator so they don't have to go to the supermarket.
    
    CRITICAL INSTRUCTION:
    - Return of items MUST be in Vietnamese (Tiếng Việt) as this is a Vietnamese cooking app.
    - Set "isInFridge" to true if the suggested substitute exists in their refrigerator list, otherwise false. Be intelligent in fuzzy matching (e.g. if their fridge has "thịt heo dăm" or "thịt nạc", it matches "thịt heo").
    - Give a brief, cheerful 1-sentence cooking note in Vietnamese (Tiếng Việt) on how the change might affect the taste/cooking style.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      suggestions: {
        type: Type.ARRAY,
        description: "A list of suggestions, one per missing ingredient",
        items: {
          type: Type.OBJECT,
          properties: {
            missingIngredient: {
              type: Type.STRING,
              description: "The name of the missing ingredient exactly as provided (in Vietnamese)"
            },
            substitutes: {
              type: Type.ARRAY,
              description: "List of 1 to 3 suitable substitute options",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "The replacement ingredient name in Vietnamese (e.g., 'Thịt Gà' or 'Nấm Rơm')"
                  },
                  description: {
                    type: Type.STRING,
                    description: "Note in Vietnamese on why this substitute works and its cooking tip (e.g., 'Tăng độ thanh ngọt, thái lát xào lăn')"
                  },
                  isInFridge: {
                    type: Type.BOOLEAN,
                    description: "True if a version of this ingredient is in the fridge list"
                  }
                },
                required: ["name", "description", "isInFridge"]
              }
            }
          },
          required: ["missingIngredient", "substitutes"]
        }
      }
    },
    required: ["suggestions"]
  };

  try {
    const ai = getGeminiClient();
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`[Gemini Substitutes] Requesting substitutes via model ${model}...`);
        response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction: "You are a professional chef helper. Output the exact response structure in JSON.",
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Substitutes] Model ${model} failed:`, err.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error("All Gemini models failed to generate substitutes.");
    }

    const textOutput = response.text || "{}";
    const result: SuggestSubstitutesResponse = JSON.parse(textOutput);
    return result;

  } catch (err) {
    console.error("Gemini Substitutes failed or key is missing. Using gourmet local rule fallback matcher:", err);
    return getFallbackSubstitutes(missingIngredients, fridgeIngredients);
  }
}

/**
 * Vietnamese Culinary Substitute Knowledge Base (Fallback Matcher)
 */
function getFallbackSubstitutes(missingIngredients: string[], fridgeIngredients: string[]): SuggestSubstitutesResponse {
  const normFridge = fridgeIngredients.map(f => f.toLowerCase().trim());
  
  // High-fidelity standard Vietnamese replacements dictionary
  const dictionary: Record<string, { alt: string; desc: string; keywords: string[] }[]> = {
    "thịt heo": [
      { alt: "Thịt gà băm", desc: "Giàu đạm lành mạnh, xào thơm hoặc hấp rất hợp.", keywords: ["gà", "chicken"] },
      { alt: "Thịt bò thăn", desc: "Hương vị đậm đà hơn, nên thái mỏng và xào chín tới nhanh.", keywords: ["bò", "beef"] },
      { alt: "Đậu hũ khuôn", desc: "Món chay thanh nhẹ, thấm gia vị xốt cực tốt.", keywords: ["đậu hũ", "đậu phụ", "tofu"] }
    ],
    "thịt heo băm": [
      { alt: "Thịt gà xay", desc: "Hương vị nhẹ dịu, xào săn đều nếm vừa vặn béo lành.", keywords: ["gà", "chicken"] },
      { alt: "Đậu hũ bóp nát", desc: "Thích hợp làm nhân nhồi, ninh hầm cực láng mịn.", keywords: ["đậu hũ", "tofu"] }
    ],
    "thịt bò": [
      { alt: "Thịt heo ba chỉ", desc: "Mềm dẻo béo ngậy, thích hợp xào lăn sả ớt sém cạnh.", keywords: ["heo", "pork"] },
      { alt: "Nấm đùi gà", desc: "Kết cấu dai giòn ngọt lịm tự nhiên thích hợp cho mọi món xào.", keywords: ["nấm", "mushroom"] }
    ],
    "trứng": [
      { alt: "Đậu hũ non", desc: "Mềm mịn lướt nhẹ môi bé, rất giàu canxi.", keywords: ["đậu hũ", "tofu"] },
      { alt: "Bí đỏ rây", desc: "Tạo độ sánh dẻo thơm và màu vàng ươm hấp dẫn.", keywords: ["bí đỏ", "pumpkin"] }
    ],
    "trứng gà": [
      { alt: "Đậu hũ non", desc: "Kết cấu mềm mịn y hệt trứng trong súp dặm nấu cháo.", keywords: ["đậu hũ", "tofu"] }
    ],
    "trứng gà ta": [
      { alt: "Đậu hũ non", desc: "Mềm mát lành ngọt thanh dịu cho trẻ nhỏ.", keywords: ["đậu hũ", "tofu"] }
    ],
    "cà chua": [
      { alt: "Quả khế chua hoặc Thơm (dứa)", desc: "Đem lại vị chua thanh mát sảng khoái kích thích vị giác.", keywords: ["dứa", "khế", "thơm", "pineapple"] },
      { alt: "Me chua dầm", desc: "Tạo vị chua đậm đà tự nhiên hoàn hảo cho canh mặn mâm cơm.", keywords: ["me", "tamarind"] }
    ],
    "rau chân vịt": [
      { alt: "Cải ngọt tươi", desc: "Giòn thanh mát, chứa nhiều chất xơ tốt cho tiêu hóa.", keywords: ["cải", "rau cải"] },
      { alt: "Rau muống đọt", desc: "Thanh mát quen thuộc, dồi dào khoáng chất cho mâm cơm Việt.", keywords: ["muống", "rau muống"] }
    ],
    "cải bó xôi": [
      { alt: "Đọt rau ngót", desc: "Ninh cháo dặm rất thơm ngọt lành cho trẻ nhỏ tập ăn.", keywords: ["ngót", "rau ngót"] },
      { alt: "Súp lơ xanh băm", desc: "Dồi dào vitamin C và hấp chín rây nhuyễn mịn cho bé ngon giấc.", keywords: ["súp lơ", "broccoli"] }
    ],
    "bí đỏ": [
      { alt: "Cà rốt hấp chín", desc: "Vẫn giữ trọn màu đỏ cam bắt mắt và độ ngọt tự nhiên cho bé.", keywords: ["cà rốt", "carrot"] },
      { alt: "Khoai tây bở", desc: "Tạo độ kết dính bùi bùi tinh bột cao rất dấp dính thơm dẻo.", keywords: ["khoai tây", "potato"] }
    ],
    "đậu hũ non": [
      { alt: "Lòng đỏ trứng quấy", desc: "Tạo độ béo mềm mượt cho bé ăn dặm hoặc canh nếm.", keywords: ["trứng", "egg"] },
      { alt: "Khoai lang hấp nhuyễn", desc: "Bột mịn lành, tốt cho bụng dạ nhạy cảm của bé.", keywords: ["khoai lang", "potato"] }
    ],
    "sả": [
      { alt: "Gừng tươi đập dập", desc: "Tạo mùi ấm nồng dễ chịu khử mùi tanh cực bén cho đĩa nhậu.", keywords: ["gừng", "ginger"] },
      { alt: "Tỏi củ phi thơm", desc: "Dậy vị thơm bùi bốc khói dọn đĩa lai rai tưng bừng.", keywords: ["tỏi", "garlic"] }
    ],
    "ớt": [
      { alt: "Tiêu sọ xay nhuyễn", desc: "Hương cay ấm vừa tầm mà không làm rát họng, thơm xa dậy vị.", keywords: ["tiêu", "pepper"] },
      { alt: "Tương ớt cay", desc: "Tạo độ sệt đậm màu sắc đỏ bắt mắt cho món xốt cay nóng.", keywords: ["tương ớt", "chili sauce"] }
    ],
    "hành hoa": [
      { alt: "Hành tây hành củ thái lát", desc: "Xào giòn hăng ngọt bùi đậm đà mâm cơm gia đình ấm áp.", keywords: ["hành tây", "onion"] }
    ],
    "gạo tẻ": [
      { alt: "Bột yến mạch", desc: "Chín cực kỳ nhanh sánh nhuyễn mịn dinh dưỡng rất khỏe.", keywords: ["yến mạch", "oat"] }
    ]
  };

  const suggestions: IngredientSubstitute[] = missingIngredients.map(missing => {
    const key = missing.toLowerCase().trim();
    
    // Find closest match in dictionary
    let matchKey = Object.keys(dictionary).find(dKey => key.includes(dKey) || dKey.includes(key));
    const substituteOptions = dictionary[matchKey || "thịt heo"] || [
      { alt: "Cà rốt thái nhỏ", desc: "Sử dụng phổ biến nâng vị ngọt súp và món xào xào.", keywords: ["cà rốt", "carrot"] },
      { alt: "Nấm tươi dai bùi", desc: "Món thay thế đa năng tự nhiên giàu axit amin lành mạnh.", keywords: ["nấm", "mushroom"] }
    ];

    const substitutes = substituteOptions.map(opt => {
      // Check if candidate is in fridge list
      const hasInFridge = normFridge.some(fIngredient => 
        opt.keywords.some(kw => fIngredient.includes(kw)) || fIngredient.includes(opt.alt.toLowerCase())
      );
      return {
        name: opt.alt,
        description: opt.desc,
        isInFridge: hasInFridge
      };
    });

    return {
      missingIngredient: missing,
      substitutes: substitutes
    };
  });

  return { suggestions };
}
