
import { RecipeSet, RecipeSource } from "../types";

const API_KEY = process.env.API_KEY;
const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

const getSystemInstruction = (language: string, timeLimit: string) => `
You are "CookIQ", the world's most responsible and intelligent multi-recipe culinary assistant.
Your goal is to provide multiple safe, delicious, and diverse recipe options (at least 3 if possible).

STRICT TIME CONSTRAINT:
User has specified a time limit of: ${timeLimit}. 
- If time is not "Any", prioritize recipes that can be completed (prep + cook) within this average time.
- Clearly state the "cookingTime" as the average time taken.

STRICT SAFETY & ETHICS:
1. TOXICITY/WILD MEAT: Strictly identify and filter hazardous items (foxglove, poisonous mushrooms) or unethical wild meats (snake, crocodile, bushmeat). 
2. NEVER provide cooking steps for toxic or wild/unethical meats. Mention them in "safetyAlerts" only.
3. NON-FOOD: List objects like "plastic" or "shoes" in "nonFood" and ignore them for cooking.

CULINARY RULES:
1. Provide a variety of recipes (e.g., one fast, one traditional, one creative).
2. Each recipe must have specific amounts and estimated nutrition facts.
3. Use only the provided edible ingredients + common staples (oil, salt, water, common spices).

OUTPUT REQUIREMENTS:
- JSON format only.
- Language: ${language}.
`;

export const analyzeImageForIngredients = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    console.log("[analyzeImageForIngredients] Starting image analysis...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: "Identify all items in this image. Distinguish between standard food, wild/unsafe meat, toxic items, and non-food. Return as a comma-separated list.",
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      console.error("[analyzeImageForIngredients] API Error:", error);
      throw new Error(`API Error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";
    console.log("[analyzeImageForIngredients] Success:", result);
    return result;
  } catch (error) {
    console.error("[analyzeImageForIngredients] Exception:", error);
    throw error;
  }
};

export const generateRecipe = async (ingredients: string, language: string, timeLimit: string): Promise<RecipeSet> => {
  try {
    console.log("[generateRecipe] Starting recipe generation...", { ingredients, language, timeLimit });
    
    const systemPrompt = getSystemInstruction(language, timeLimit);
    const userPrompt = `USER INPUT: ${ingredients}. Preferred Average Time: ${timeLimit}. Generate 3 diverse, safe recipes in ${language}.

IMPORTANT: Return ONLY valid JSON with this exact structure:
{
  "analysis": {
    "categorization": {
      "edible": ["item1", "item2"],
      "wildOrUnsafe": ["item"],
      "nonFood": ["item"],
      "toxic": ["item"]
    },
    "safetyAlerts": ["alert1", "alert2"]
  },
  "recipes": [
    {
      "dishName": "string",
      "cookingTime": "string",
      "dishType": "Vegetarian" | "Non-Vegetarian",
      "ingredients": [
        {"item": "string", "amount": "string"}
      ],
      "steps": ["step1", "step2"],
      "nutrition": {
        "calories": "string",
        "protein": "string",
        "carbs": "string",
        "fats": "string"
      }
    }
  ]
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    console.log("[generateRecipe] Sending request to OpenRouter...");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "CookIQ",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("[generateRecipe] Response status:", response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error("[generateRecipe] API Error:", error);
      throw new Error(`ApiError: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    console.log("[generateRecipe] Response data:", data);
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("[generateRecipe] No content in response");
      throw new Error("No response from AI");
    }

    console.log("[generateRecipe] Content length:", content.length);
    
    // Extract JSON from response (handles cases where model returns extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[generateRecipe] No JSON found in content:", content);
      throw new Error("No JSON found in response");
    }

    console.log("[generateRecipe] Parsing JSON...");
    const result = JSON.parse(jsonMatch[0]) as RecipeSet;
    console.log("[generateRecipe] Success! Generated", result.recipes?.length || 0, "recipes");
    return result;
  } catch (error) {
    console.error("[generateRecipe] Exception:", error);
    throw error;
  }
};

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const connectVoiceAssistant = (callbacks: any, language: string) => {
  console.log("Voice assistant not yet implemented for OpenRouter API");
  return null;
};
