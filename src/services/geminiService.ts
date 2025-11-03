import { GoogleGenAI } from "@google/genai";

export const generateWifiName = async (): Promise<string> => {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set for Gemini.");
        throw new Error("Gemini API key is not configured.");
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Suggest one extremely creative and cool name for a SULIT WIFI hotspot network. The name should be short, catchy, and tech-themed. Provide only the name, no extra text or explanations.',
        });
        
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to generate Wi-Fi name from Gemini API.");
    }
};
