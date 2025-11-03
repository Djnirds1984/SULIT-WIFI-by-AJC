import React, { useState, useEffect, useCallback } from 'react';
import { getVouchers, generateNewVoucher } from '../../services/wifiService';
import { ClipboardIcon } from '../icons/ClipboardIcon';

interface Voucher {
    code: string;
    duration: number;
}

const DURATION_OPTIONS = [
    { label: '5 Minutes', value: 300 },
    { label: '1 Hour', value: 3600 },
    { label: '3 Hours', value: 10800 },
    { label: '1 Day', value: 86400 },
];

const VoucherManager: React.FC = () => {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState<number>(DURATION_OPTIONS[0].value);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getVouchers();
            setVouchers(data.reverse()); // Show newest first
        } catch (error) {
            console.error("Failed to fetch vouchers", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVouchers();
    }, [fetchVouchers]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGeneratedCode(null);
        try {
            const newCode = await generateNewVoucher(selectedDuration);
            setGeneratedCode(newCode);
            await fetchVouchers(); // Refresh list
        } catch (error) {
            console.error("Failed to generate voucher", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 3600) return `${seconds / 60} min`;
        if (seconds < 86400) return `${seconds / 3600} hr`;
        return `${seconds / 86400} day`;
    };

    return (
        <div className="space-y-6 animate-fade-in-slow">
            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Generate New Voucher</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select
                        value={selectedDuration}
                        onChange={(e) => setSelectedDuration(Number(e.target.value))}
                        className="flex-grow bg-slate-900/50 border-2 border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        aria-label="Select voucher duration"
                    >
                        {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <button onClick={handleGenerate} disabled={isGenerating} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-wait">
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
                {generatedCode && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-lg text-center">
                        <p className="text-sm text-slate-400">New Code:</p>
                        <p className="font-mono text-lg text-green-400">{generatedCode}</p>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-2">Available Vouchers</h3>
                {isLoading ? <p className="text-slate-400">Loading vouchers...</p> : (
                    <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700 relative">
                        {vouchers.map(({ code, duration }) => (
                            <div key={code} className="flex justify-between items-center bg-slate-800 p-2 rounded-md">
                                <p className="font-mono text-sky-300">{code}</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">{formatDuration(duration)}</span>
                                    <button onClick={() => handleCopy(code)} title="Copy code" className="text-slate-400 hover:text-white">
                                        <ClipboardIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                         {copiedCode && <p className="text-xs text-green-400 text-center sticky bottom-0 bg-slate-900/80 backdrop-blur-sm py-1 animate-fade-in">Copied to clipboard!</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoucherManager;