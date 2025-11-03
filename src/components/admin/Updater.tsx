import React, { useState, useEffect } from 'react';
import { getUpdaterStatus } from '../../services/wifiService';
import { UpdaterStatus } from '../../types';
import { CloudArrowDownIcon, ArchiveBoxIcon, ArrowUturnLeftIcon, TrashIcon } from '../icons';

const Updater: React.FC = () => {
    const [status, setStatus] = useState<UpdaterStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getUpdaterStatus().then(setStatus).finally(() => setIsLoading(false));
    }, []);

    const handleAction = (action: string) => {
        alert(`Feature not implemented: ${action}`);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Updater & Backup</h1>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Software Update</h2>
                {isLoading ? <p>Checking for updates...</p> : (
                    status && (
                        <div className="space-y-4">
                            <p><strong>Status:</strong> {status.statusText}</p>
                            <p><strong>Current Version:</strong> {status.localCommit}</p>
                            {status.isUpdateAvailable ? (
                                <button
                                    onClick={() => handleAction('Update')}
                                    className="flex items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                                >
                                    <CloudArrowDownIcon className="h-5 w-5 mr-2" />
                                    Update Now
                                </button>
                            ) : (
                                <p className="text-green-600">You are on the latest version.</p>
                            )}
                        </div>
                    )
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Backup & Restore</h2>
                <p className="text-sm text-gray-500 mb-4">Create or restore a backup of your settings and vouchers.</p>
                <div className="flex space-x-4">
                    <button
                        onClick={() => handleAction('Backup')}
                        className="flex items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                        Create Backup
                    </button>
                    <button
                        onClick={() => handleAction('Restore')}
                        className="flex items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <ArrowUturnLeftIcon className="h-5 w-5 mr-2" />
                        Restore from Backup
                    </button>
                </div>
            </div>

             <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <h2 className="text-xl font-semibold text-yellow-700 mb-4">Manage Backups</h2>
                <p className="text-gray-600 mb-4">This section will list available backups to restore or delete.</p>
                <div className="border rounded-lg p-4 text-center text-gray-500">
                     No backups found.
                </div>
            </div>
        </div>
    );
};

export default Updater;
