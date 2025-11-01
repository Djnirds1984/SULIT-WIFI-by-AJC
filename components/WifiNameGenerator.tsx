import React, { useState, useCallback } from 'react';
import { generateWifiName } from '../services/geminiService.ts';

interface WifiNameGeneratorProps {
    onApplyIdea: (idea: string) => void;
}

const WifiNameGenerator: React.FC<WifiNameGeneratorProps> = ({ onApplyIdea }) => {
    const [nameIdea, setNameIdea] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setNameIdea(null);
        try {
            const result = await generateWifiName();
            setNameIdea(result.split('\n')[0]);
        } catch (err) {
            setError('Could not generate name. Please ensure API key is set.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const handleApply = () => {
        if (nameIdea) {
            onApplyIdea(nameIdea);
            setNameIdea(null);
        }
    }

    return (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-indigo-400">SSID Idea Generator</h3>
            <p className="text-xs text-slate-400 mt-1 mb-3">
                Need inspiration? Let Gemini help!
            </p>
            
            {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
            
            {nameIdea && (
                 <div className="my-3 text-center bg-slate-800 p-3 rounded-lg flex items-center justify-between gap-2">
                    <p className="font-bold text-md text-sky-300 whitespace-pre-wrap font-mono text-left">{nameIdea}</p>
                    <button onClick={handleApply} className="text-sm bg-sky-600 text-white font-semibold py-1 px-3 rounded-md hover:bg-sky-500 flex-shrink-0">
                        Use This
                    </button>
                 </div>
            )}
            
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full text-sm bg-slate-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-400 transition-all duration-300 disabled:bg-slate-700 disabled:cursor-wait"
            >
                {isLoading ? 'Generating...' : 'Get New Idea'}
            </button>
        </div>
    );
};

export default WifiNameGenerator;