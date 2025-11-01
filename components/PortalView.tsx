
import React, { useState } from 'react';
import { TicketIcon } from './icons/TicketIcon';

interface PortalViewProps {
  onActivate: (code: string) => void;
  onCoinInsert: () => void;
  isLoading: boolean;
  error: string | null;
}

const PortalView: React.FC<PortalViewProps> = ({ onActivate, onCoinInsert, isLoading, error }) => {
  const [voucherCode, setVoucherCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherCode.trim() && !isLoading) {
      onActivate(voucherCode.trim().toUpperCase());
    }
  };

  const handleCoinSubmit = () => {
    if (!isLoading) {
        onCoinInsert();
    }
  }

  return (
    <div className="flex flex-col items-center animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-sky-300">Get Connected</h2>
      <p className="mt-2 text-center text-slate-400">
        Enter your voucher code or insert a coin to activate your internet session.
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
       <div className="flex items-center w-full my-6">
          <div className="flex-grow border-t border-slate-600"></div>
          <span className="flex-shrink mx-4 text-slate-500 text-sm font-semibold">OR</span>
          <div className="flex-grow border-t border-slate-600"></div>
      </div>
      
      <div className="w-full flex flex-col items-center">
        <h3 className="text-xl font-bold text-amber-300">Pay with Coins</h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">1 Coin = 15 Minutes</p>
        
        <button
            onClick={handleCoinSubmit}
            disabled={isLoading}
            className="group relative w-48 h-20 bg-slate-800 border-4 border-slate-600 rounded-xl flex items-center justify-center p-2 shadow-lg transition-all hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-slate-600"
            aria-label="Insert Coin to get 15 minutes of internet"
        >
            <div className="w-40 h-full bg-slate-700 rounded-md flex items-center justify-center shadow-inner shadow-black/30">
                <div className="w-2 h-10 bg-black rounded-sm shadow-inner shadow-slate-900 group-hover:bg-amber-400 group-hover:shadow-amber-500/50 transition-all"></div>
            </div>
             <div className="absolute -bottom-4 bg-slate-800 px-3 py-0.5 rounded-md border-2 border-slate-600 group-hover:border-amber-400 transition-all">
                <span className="text-amber-400 font-bold text-sm tracking-wider uppercase group-hover:text-amber-300">Insert Coin</span>
             </div>
        </button>

         <p className="text-xs mt-8 text-slate-500 text-center">
            This simulates a physical coin slot.
            <br />
            Clicking will start a 15-minute session.
        </p>
      </div>
    </div>
  );
};

export default PortalView;