import React, { useState, useEffect } from 'react';
import { getVouchers, createVoucher } from '../../services/wifiService';
import { Voucher } from '../../types';
import { ClipboardIcon } from '../icons/ClipboardIcon';

const VoucherManager: React.FC = () => {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [duration, setDuration] = useState(60); // Default 1 hour in minutes
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedCode, setCopiedCode] = useState('');
    const [error, setError] = useState('');

    const fetchVouchers = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await getVouchers();
            setVouchers(data);
        } catch (error: any) {
            console.error(error);
            setError(error.message || "Could not fetch vouchers.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVouchers();
    }, []);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError('');
        try {
            await createVoucher(duration * 60); // API expects seconds
            await fetchVouchers(); // Refresh list
        } catch (error: any) {
            console.error(error);
            setError(error.message || "Could not generate voucher.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(''), 2000);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Voucher Manager</h1>
            
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Generate New Voucher</h2>
                <div className="flex items-center space-x-4">
                    <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                        <input
                            type="number"
                            id="duration"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            min="1"
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="self-end py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                 <h2 className="text-xl font-semibold text-gray-700 mb-4">Available Vouchers</h2>
                 {isLoading ? <p>Loading vouchers...</p> : (
                     <div className="overflow-x-auto">
                         <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                                 <tr>
                                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                     <th scope="col" className="relative px-6 py-3"><span className="sr-only">Copy</span></th>
                                 </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                 {vouchers.map(v => (
                                     <tr key={v.code}>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{v.code}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.duration / 60} minutes</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                             <button onClick={() => copyToClipboard(v.code)} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                                 <ClipboardIcon className="h-5 w-5 mr-1"/>
                                                 {copiedCode === v.code ? 'Copied!' : 'Copy'}
                                             </button>
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default VoucherManager;
