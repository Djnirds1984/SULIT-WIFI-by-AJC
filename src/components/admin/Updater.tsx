import React, { useState, useEffect } from 'react';
import { getUpdaterStatus, listBackups, createBackup, restoreBackup, deleteBackup } from '../../services/wifiService';
import { UpdaterStatus } from '../../types';
import CloudArrowDownIcon from '../icons/CloudArrowDownIcon';
import ArchiveBoxIcon from '../icons/ArchiveBoxIcon';
import ArrowUturnLeftIcon from '../icons/ArrowUturnLeftIcon';
import TrashIcon from '../icons/TrashIcon';

const Updater: React.FC = () => {
    const [status, setStatus] = useState<UpdaterStatus | null>(null);
    const [backups, setBackups] = useState<string[]>([]);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isLoadingBackups, setIsLoadingBackups] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const fetchStatus = async () => {
        setIsLoadingStatus(true);
        try {
            const statusData = await getUpdaterStatus();
            setStatus(statusData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingStatus(false);
        }
    };
    
    const fetchBackups = async () => {
        setIsLoadingBackups(true);
        try {
            const backupFiles = await listBackups();
            setBackups(backupFiles);
        } catch (err: any) {
            setError(err.message || "Could not load backups.");
        } finally {
            setIsLoadingBackups(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchBackups();
    }, []);
    
    const clearMessages = () => {
        setMessage('');
        setError('');
    };

    const handleCreateBackup = async () => {
        clearMessages();
        setIsProcessing(true);
        try {
            const res = await createBackup();
            setMessage(res.message);
            await fetchBackups(); // Refresh the list
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestoreBackup = async (filename: string) => {
        if (window.confirm(`Are you sure you want to restore from "${filename}"? This will overwrite all current settings and vouchers.`)) {
            clearMessages();
            setIsProcessing(true);
            try {
                const res = await restoreBackup(filename);
                setMessage(res.message + " The page will now reload.");
                setTimeout(() => window.location.reload(), 3000);
            } catch (err: any) {
                setError(err.message);
                setIsProcessing(false);
            }
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (window.confirm(`Are you sure you want to permanently delete the backup file "${filename}"?`)) {
            clearMessages();
            setIsProcessing(true);
            try {
                const res = await deleteBackup(filename);
                setMessage(res.message);
                setBackups(prev => prev.filter(b => b !== filename)); // Optimistic update
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Updater & Backup</h1>

            {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">{message}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Software Update</h2>
                {isLoadingStatus ? <p>Checking for updates...</p> : (
                    status && (
                        <div className="space-y-4">
                            <p><strong>Status:</strong> {status.statusText}</p>
                            <p><strong>Current Version:</strong> <span className="font-mono text-sm">{status.localCommit}</span></p>
                            {status.isUpdateAvailable ? (
                                <button
                                    disabled={true}
                                    className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                >
                                    <CloudArrowDownIcon className="h-5 w-5 mr-2" />
                                    Update Now
                                </button>
                            ) : (
                                <p className="text-green-600 font-semibold">You are on the latest version.</p>
                            )}
                        </div>
                    )
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Backup & Restore</h2>
                <p className="text-sm text-gray-500 mb-4">Create a backup of your settings and vouchers. Restore will overwrite existing data.</p>
                <div className="flex space-x-4">
                    <button
                        onClick={handleCreateBackup}
                        disabled={isProcessing}
                        className="flex items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200"
                    >
                        <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                        {isProcessing ? 'Processing...' : 'Create Backup'}
                    </button>
                </div>
            </div>

             <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Manage Backups</h2>
                {isLoadingBackups ? <p>Loading backups...</p> : (
                    backups.length > 0 ? (
                        <div className="space-y-3">
                            {backups.map(filename => (
                                <div key={filename} className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                                    <span className="font-mono text-sm text-gray-800">{filename}</span>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleRestoreBackup(filename)}
                                            disabled={isProcessing}
                                            className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                                        >
                                            <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
                                            Restore
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBackup(filename)}
                                            disabled={isProcessing}
                                            className="flex items-center text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                                        >
                                            <TrashIcon className="h-4 w-4 mr-1" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="border rounded-lg p-4 text-center text-gray-500">
                             No backups found.
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default Updater;