
import React, { useState } from 'react';
import { TicketIcon } from './icons/TicketIcon';

interface PortalViewProps {
  onActivate: (code: string) => void;
  isLoading: boolean;
  error: string | null;
}

const PortalView: React.FC<PortalViewProps> = ({ onActivate, isLoading, error }) => {
  const [voucherCode, setVoucherCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherCode.trim() && !isLoading) {
      onActivate(voucherCode.trim().toUpperCase());
    }
  };

  return (
    <div className="flex flex-col items-center animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-sky-300">Get Connected</h2>
      <p className="mt-2 text-center text-slate-400">
        Enter your voucher code below to activate your internet session.
      </p>

      <form onSubmit={handleSubmit} className="w-full mt-6">
        <div className="relative">
          <TicketIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
            placeholder="VOUCHER-CODE"
            className="w-full bg-slate-900/50 border-2 border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-center tracking-widest font-mono"
            disabled={isLoading}
            aria-label="Voucher Code Input"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-center text-red-400 bg-red-900/50 px-3 py-2 rounded-md animate-shake">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || !voucherCode.trim()}
          className="w-full mt-4 bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-all duration-300 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Activating...
            </>
          ) : (
            'Activate Session'
          )}
        </button>
      </form>
      <p className="text-xs mt-4 text-slate-500">Don't have a code? Please approach the counter.</p>
    </div>
  );
};

export default PortalView;
