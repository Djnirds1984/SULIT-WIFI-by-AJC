import React, { useState, useEffect } from 'react';
import { getPortalHtml, updatePortalHtml, resetPortalHtml } from '../../services/wifiService';
import { SaveIcon, ArrowPathIcon } from '../icons';

const PortalEditor: React.FC = () => {
    const [html, setHtml] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const fetchHtml = async () => {
        setIsLoading(true);
        try {
            const data = await getPortalHtml();
            setHtml(data.html);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHtml();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        setError('');
        try {
            const res = await updatePortalHtml(html);
            setMessage(res.message);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (window.confirm("Are you sure you want to reset the portal HTML to its default?")) {
            setIsSaving(true);
            setMessage('');
            setError('');
            try {
                const res = await resetPortalHtml();
                setHtml(res.html);
                setMessage("Portal HTML has been reset.");
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (isLoading) return <div>Loading portal editor...</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Portal Editor</h1>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="font-bold text-yellow-800">Feature Not Implemented</p>
                <p className="text-yellow-700">This editor is a placeholder. Saving changes will not currently affect the user portal.</p>
            </div>
            
            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-700">Portal HTML</h2>
                    <div className="flex space-x-2">
                        <button
                            onClick={handleReset}
                            disabled={isSaving}
                            className="flex items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200"
                        >
                           <ArrowPathIcon className="h-5 w-5 mr-2" />
                           Reset to Default
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
                        >
                            <SaveIcon className="h-5 w-5 mr-2" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    className="w-full h-96 p-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder="Enter portal HTML here..."
                />
            </div>
        </div>
    );
};

export default PortalEditor;
