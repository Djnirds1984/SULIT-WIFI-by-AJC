import React, { useState, useEffect, useCallback } from 'react';
import { getPortalHtml, updatePortalHtml, resetPortalHtml } from '../../services/wifiService';
import { SaveIcon } from '../icons/SaveIcon';
import { ArrowPathIcon } from '../icons/ArrowPathIcon';

const PortalEditor: React.FC = () => {
    const [htmlContent, setHtmlContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchHtml = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { html } = await getPortalHtml();
            setHtmlContent(html);
        } catch (err) {
            setError('Failed to load portal HTML. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHtml();
    }, [fetchHtml]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await updatePortalHtml(htmlContent);
            setSuccess('Portal HTML saved successfully!');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccess(null), 3000);
        }
    };

    const handleReset = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to reset the portal HTML to its default state? Any custom changes will be lost.'
        );
        if (confirmed) {
            setIsSaving(true);
            setError(null);
            setSuccess(null);
            try {
                const { html } = await resetPortalHtml();
                setHtmlContent(html);
                setSuccess('Portal HTML has been reset to default.');
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsSaving(false);
                setTimeout(() => setSuccess(null), 3000);
            }
        }
    };

    if (isLoading) {
        return <p className="text-slate-400 text-center">Loading portal editor...</p>;
    }
    
    const anyActionInProgress = isLoading || isSaving;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Captive Portal Editor</h3>
                <p className="text-xs text-slate-400">
                    Customize the HTML of the splash page presented to users. The default page contains a simple redirect.
                </p>
                <p className="text-xs text-amber-400 mt-1">
                    Warning: Incorrectly editing this file may break the user login flow. Use the reset button if needed.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <button 
                    onClick={handleSave} 
                    disabled={anyActionInProgress}
                    className="flex-1 flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-wait"
                >
                    <SaveIcon className="w-5 h-5"/>
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
                 <button 
                    onClick={handleReset} 
                    disabled={anyActionInProgress}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-wait"
                >
                    <ArrowPathIcon className="w-5 h-5"/>
                    <span>{isSaving ? 'Resetting...' : 'Reset to Default'}</span>
                </button>
            </div>
            
            {error && <p className="text-sm text-center text-red-400 p-2 bg-red-900/30 rounded-md">{error}</p>}
            {success && <p className="text-sm text-center text-green-400 p-2 bg-green-900/30 rounded-md">{success}</p>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                    <h4 className="font-semibold text-slate-300 mb-2">HTML Editor</h4>
                    <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        className="w-full h-96 font-mono text-sm bg-slate-900/50 border-2 border-slate-600 rounded-lg py-2 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        spellCheck="false"
                        aria-label="Portal HTML Editor"
                        disabled={anyActionInProgress}
                    />
                </div>
                <div>
                     <h4 className="font-semibold text-slate-300 mb-2">Live Preview</h4>
                     <iframe
                        srcDoc={htmlContent}
                        title="Portal Preview"
                        sandbox=""
                        className="w-full h-96 bg-white border-2 border-slate-600 rounded-lg"
                     />
                </div>
            </div>
        </div>
    );
};

export default PortalEditor;