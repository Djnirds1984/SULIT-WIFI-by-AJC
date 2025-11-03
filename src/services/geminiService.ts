import { GoogleGenAI } from "@google/genai";

// Per guidelines, assume process.env.API_KEY is available and injected.
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.warn("Gemini API key not found. Wi-Fi Name Generator will be disabled.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateWifiName = async (prompt: string): Promise<string> => {
    if (!ai) {
        throw new Error("Gemini API key is not configured.");
    }

    try {
        const response = await ai.models.generateContent({
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