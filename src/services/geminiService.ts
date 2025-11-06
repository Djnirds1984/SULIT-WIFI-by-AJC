import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

// FIX: Encapsulate client creation and API key handling within the service.
const getAiClient = (): GoogleGenAI | null => {
    if (ai) {
        return ai;
    }
    // FIX: API key MUST be from process.env.API_KEY per guidelines.
    if (process.env.API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        return ai;
    } else {
        console.warn("Gemini API key not found in environment variables. Wi-Fi Name Generator will be disabled.");
        return null;
    }
};

export const initializeGeminiClient = () => {
    // This function can be called on app start to eagerly initialize the client.
    getAiClient();
};

export const generateWifiName = async (prompt: string): Promise<string> => {
    // FIX: Ensure client is initialized before use.
    const geminiClient = getAiClient();
    if (!geminiClient) {
        throw new Error("Gemini client not initialized. Is API_KEY set in environment?");
    }

    try {
        const response = await geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a funny, creative, or cool Wi-Fi network name (SSID). The name should be based on this theme: "${prompt}". The name must be 32 characters or less and contain only letters, numbers, and basic symbols. Just return the name itself, with no extra text or quotation marks.`,
            config: {
                maxOutputTokens: 20,
                temperature: 0.9,
            }
        });
        
        const text = response.text.trim();
        
        // Provide a fallback if the response is empty
        return text || `SULIT ${prompt}`;
    } catch (error) {
        console.error("Error generating Wi-Fi name with Gemini:", error);
        // Fallback on error for better user experience
        return `SULIT WIFI Zone`;
    }
};
