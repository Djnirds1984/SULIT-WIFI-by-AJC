// FIX: Import GoogleGenAI class from "@google/genai"
import { GoogleGenAI } from "@google/genai";

// FIX: Initialize GoogleGenAI with a named apiKey parameter from process.env.API_KEY
// Per guidelines, assume process.env.API_KEY is available and injected at build time.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generateWifiName = async (prompt: string): Promise<string> => {
    try {
        // FIX: Use ai.models.generateContent with model and contents
        const response = await ai.models.generateContent({
            // FIX: Use 'gemini-2.5-flash' for basic text tasks.
            model: 'gemini-2.5-flash',
            contents: `Generate a funny, creative, or cool Wi-Fi network name (SSID). The name should be based on this theme: "${prompt}". The name must be 32 characters or less and contain only letters, numbers, and basic symbols. Just return the name itself, with no extra text or quotation marks.`,
            config: {
                // An SSID is short, so a small max output is fine.
                maxOutputTokens: 20,
                temperature: 0.9,
            }
        });
        
        // FIX: Access the generated text directly from the response.text property.
        const text = response.text.trim();
        
        // Provide a fallback if the response is empty
        return text || `SULIT ${prompt}`;
    } catch (error) {
        console.error("Error generating Wi-Fi name with Gemini:", error);
        // Fallback on error for better user experience
        return `SULIT WIFI Zone`;
    }
};
