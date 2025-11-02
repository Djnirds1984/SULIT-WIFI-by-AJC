import React, { useState, useEffect } from 'react';
import { getUpdaterStatus, triggerUpdate, createBackup, restoreFromBackup, deleteBackup } from '../../services/wifiService';
import { UpdaterStatus } from '../../types';
import { CloudArrowDownIcon } from '../icons/CloudArrowDownIcon';
import { CogIcon } from '../icons/CogIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { ArrowUturnLeftIcon } from '../icons/ArrowUturnLeftIcon';
import { TrashIcon } from '../icons/TrashIcon';

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
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backupMessage, setBackupMessage] = useState<string | null>(null);


    const checkStatus = async () => {
        setIsLoading(true);
        setError(null);
        setBackupMessage(null);
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
                // Server restarts, user must manually refresh.
            } catch (err) {
                 setError('The update command failed to start. Check server logs.');
                 setIsUpdating(false);
            }
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        setError(null);
        setBackupMessage(null);
        try {
            const result = await createBackup();
            setBackupMessage(result.message);
            await checkStatus(); // Refresh status to show new backup file
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsBackingUp(false);
        }
    };
    
    const handleRestore = async () => {
         const confirmed = window.confirm(
            'Are you sure you want to restore from the backup? This will overwrite all current files and restart the server.'
        );
        if (confirmed) {
            setIsRestoring(true);
            setError(null);
            setBackupMessage(null);
            try {
                await restoreFromBackup();
                // Server restarts, user must manually refresh.
            } catch (err) {
                setError((err as Error).message);
                setIsRestoring(false);
            }
        }
    };

    const handleDeleteBackup = async () => {
         const confirmed = window.confirm(
            'Are you sure you want to permanently delete the backup file?'
        );
         if (confirmed) {
            setIsDeleting(true);
            setError(null);
            setBackupMessage(null);
            try {
                const result = await deleteBackup();
                setBackupMessage(result.message);
                await checkStatus(); // Refresh status to remove backup file info
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsDeleting(false);
            }
        }
    };
    
    const anyActionInProgress = isLoading || isUpdating || isBackingUp || isRestoring || isDeleting;

    if (isUpdating || isRestoring) {
        return (
            <div className="text-center p-8 bg-slate-900/50 rounded-lg animate-fade-in">
                <CogIcon className="w-12 h-12 text-sky-400 mx-auto animate-spin" />
                <h3 className="text-xl font-bold text-sky-300 mt-4">
                    {isUpdating ? 'Update in Progress...' : 'Restore in Progress...'}
                </h3>
                <p className="text-slate-400 mt-2">
                    The server is applying changes and will restart shortly.
                    <br />
                    Please wait a minute and then <span className="font-bold text-white">manually refresh this page</span>.
                </p>
            </div>
        );
    }
    
    const formattedBackupDate = status?.backupDate ? new Date(status.backupDate).toLocaleString() : '';

    return (
        <div className="space-y-8 animate-fade-in-slow">
            {/* --- Application Updater --- */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-xl font-bold text-indigo-400">Application Updater</h3>
                    <p className="text-xs text-slate-400">Check for updates from the official GitHub repository.</p>
                </div>

                <button onClick={checkStatus} disabled={anyActionInProgress} className="w-full bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-wait">
                    {isLoading ? 'Checking...' : 'Check for Updates'}
                </button>
            
                {error && <p className="text-sm text-center text-red-400">{error}</p>}
                {status && <StatusDisplay status={status} />}
                
                {status?.isUpdateAvailable && (
                    <button 
                        onClick={handleUpdate} 
                        disabled={anyActionInProgress} 
                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-wait"
                    >
                        <CloudArrowDownIcon className="w-5 h-5"/>
                        Pull & Restart Server
                    </button>
                )}
            </div>

            {/* --- Backup & Restore --- */}
             <div className="space-y-4 pt-6 border-t border-slate-700">
                <div>
                    <h3 className="text-xl font-bold text-indigo-400">Backup & Restore</h3>
                    <p className="text-xs text-slate-400">Create a backup of the current application state, or restore from a previous backup.</p>
                </div>
                
                 {backupMessage && <p className="text-sm text-center text-green-400">{backupMessage}</p>}

                 {status?.backupFile ? (
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-center">
                        <p className="text-sm text-slate-300">Last backup created:</p>
                        <p className="font-mono text-xs text-sky-300">{status.backupFile}</p>
                        <p className="text-xs text-slate-500">{formattedBackupDate}</p>
                    </div>
                ) : (
                    <p className="text-center text-sm text-slate-500 p-3 bg-slate-900/50 rounded-lg">No backup found.</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                     <button onClick={handleBackup} disabled={anyActionInProgress} className="flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-wait">
                        <ArchiveBoxIcon className="w-5 h-5"/>
                        <span>{isBackingUp ? 'Creating...' : 'Create Backup'}</span>
                    </button>
                     <button onClick={handleRestore} disabled={anyActionInProgress || !status?.backupFile} className="flex items-center justify-center gap-2 bg-amber-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">
                        <ArrowUturnLeftIcon className="w-5 h-5"/>
                        <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                    </button>
                    <button onClick={handleDeleteBackup} disabled={anyActionInProgress || !status?.backupFile} className="flex items-center justify-center gap-2 bg-red-700 text-white font-bold py-2 px-3 rounded-lg hover:bg-red-600 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400">
                        <TrashIcon className="w-5 h-5"/>
                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Updater;