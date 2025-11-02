import React, { useState, useEffect } from 'react';
import { getUpdaterStatus, triggerUpdate } from '../../services/wifiService';
import { UpdaterStatus } from '../../types';
import { CloudArrowDownIcon } from '../icons/CloudArrowDownIcon';
import { CogIcon } from '../icons/CogIcon';

const StatusDisplay: React.FC<{ status: UpdaterStatus }> = ({ status }) => (
    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <p className="text-sm text-slate-400 mb-2">{status.statusText}</p>
        <div className="text-xs font-mono space-y-1 text-slate-300">
            <p>Current Version: <span className="text-sky-400">{status.localCommit}</span></p>
            {status.isUpdateAvailable && <p>Latest Version: <span className="text-green-400">{status.remoteCommit}</span></p>}
        </div>
        {status.isUpdateAvailable && (
             <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-sm font-semibold text-slate-300">Latest Commit:</p>
                <p className="text-sm text-amber-300 font-mono bg-slate-800 p-2 rounded-md mt-1">{status.commitMessage}</p>
            </div>
        )}
    </div>
);


const Updater: React.FC = () => {
    const [status, setStatus] = useState<UpdaterStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const statusData = await getUpdaterStatus();
            setStatus(statusData);
        } catch (err) {
            setError('Could not connect to the server to check for updates.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        checkStatus();
    }, []);

    const handleUpdate = async () => {
        if (!status?.isUpdateAvailable) return;
        
        const confirmed = window.confirm(
            'Are you sure you want to update? The server will restart, and you will be temporarily disconnected.'
        );

        if (confirmed) {
            setIsUpdating(true);
            setError(null);
            try {
                await triggerUpdate();
                // The server will restart, so we just show a persistent message.
                // The user needs to manually refresh.
            } catch (err) {
                 setError('The update command failed to start. Check server logs.');
                 setIsUpdating(false);
            }
        }
    };
    
    if (isUpdating) {
        return (
            <div className="text-center p-8 bg-slate-900/50 rounded-lg animate-fade-in">
                <CogIcon className="w-12 h-12 text-sky-400 mx-auto animate-spin" />
                <h3 className="text-xl font-bold text-sky-300 mt-4">Update in Progress...</h3>
                <p className="text-slate-400 mt-2">
                    The server is pulling the latest changes and will restart shortly.
                    <br />
                    Please wait a minute and then <span className="font-bold text-white">manually refresh this page</span>.
                </p>
            </div>
        );
    }
    

    return (
        <div className="space-y-6 animate-fade-in-slow">
            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Application Updater</h3>
                <p className="text-xs text-slate-400 mb-4">Check for updates from the official GitHub repository and apply them.</p>

                <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={checkStatus} disabled={isLoading} className="w-full bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-wait">
                        {isLoading ? 'Checking...' : 'Check for Updates'}
                    </button>
                </div>
            </div>
            
             {error && <p className="text-sm text-center text-red-400">{error}</p>}

             {status && <StatusDisplay status={status} />}
             
             {status?.isUpdateAvailable && (
                <div className="mt-4">
                    <button 
                        onClick={handleUpdate} 
                        disabled={isLoading || isUpdating} 
                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-wait"
                    >
                        <CloudArrowDownIcon className="w-5 h-5"/>
                        Pull & Restart Server
                    </button>
                </div>
             )}
        </div>
    );
};

export default Updater;
