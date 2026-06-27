
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || "";

export const getAICompositionAdvice = async (base64Image: string): Promise<string | null> => {
  if (!API_KEY) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1],
            },
          },
          {
            text: "Act as a professional photography coach. Briefly (under 15 words) suggest one composition improvement for this scene. Be encouraging but direct."
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || null;
  } catch (error) {
    console.error("AI Coaching Error:", error);
    return null;
  }
};
