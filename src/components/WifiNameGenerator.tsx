import React, { useState } from 'react';
import { generateWifiName } from '../services/geminiService';
// FIX: Change named import to default import for CogIcon.
import { CogIcon } from './icons/CogIcon';

interface WifiNameGeneratorProps {
    onNameGenerated: (name: string) => void;
}

const WifiNameGenerator: React.FC<WifiNameGeneratorProps> = ({ onNameGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a theme or keyword.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const name = await generateWifiName(prompt);
            onNameGenerated(name);
        } catch (e: any) {
            setError('Could not generate name. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-6 p-4 border border-dashed border-gray-300 rounded-lg">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Creative SSID Generator</h3>
            <p className="text-sm text-gray-500 mb-4">
                Feeling creative? Enter a theme (e.g., "space cats", "80s retro") and let AI suggest a fun Wi-Fi name for you to set in the admin panel.
            </p>
            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter a theme..."
                    className="flex-grow block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    disabled={isLoading}
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                    {isLoading ? (
                        <CogIcon className="animate-spin h-5 w-5 mr-2" />
                    ) : (
                        <CogIcon className="h-5 w-5 mr-2" />
                    )}
                    Generate
                </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};

export default WifiNameGenerator;