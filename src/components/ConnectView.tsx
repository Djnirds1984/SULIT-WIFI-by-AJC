import React, { useState } from 'react';
import { activateVoucher } from '../services/wifiService';
import TicketIcon from './icons/TicketIcon';
import { Session } from '../types';

interface ConnectViewProps {
    onConnect: (session: Session) => void;
}

const ConnectView: React.FC<ConnectViewProps> = ({ onConnect }) => {
    const [voucherCode, setVoucherCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!voucherCode.trim()) {
            setError('Please enter a voucher code.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const session = await activateVoucher(voucherCode);
            onConnect(session);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Connect to Internet</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label htmlFor="voucher" className="block text-sm font-medium text-gray-700">
                        Enter Voucher Code
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                            <TicketIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            id="voucher"
                            value={voucherCode}
                            onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="SULIT-XXXXXX"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                {error && <p className={`text-red-500 text-sm mb-4 text-center ${error ? 'animate-shake' : ''}`}>{error}</p>}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                >
                    {isLoading ? 'Connecting...' : 'Connect'}
                </button>
            </form>
            <div className="mt-6 text-center text-gray-500 text-sm">
                <p>No voucher? Insert a coin into the machine to start a session.</p>
            </div>
        </div>
    );
};

export default ConnectView;