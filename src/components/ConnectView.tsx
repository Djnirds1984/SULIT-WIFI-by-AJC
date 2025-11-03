import React from 'react';
import { WifiSession } from '../types';
import Timer from './Timer';
import { ClockIcon } from './icons/ClockIcon';

interface ConnectViewProps {
  session: WifiSession;
  onLogout: () => void;
  onAddTime: () => void;
}

const ConnectView: React.FC<ConnectViewProps> = ({ session, onLogout, onAddTime }) => {
  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <h2 className="text-2xl font-bold text-green-400">You are Connected!</h2>
      <p className="mt-2 text-slate-400">Enjoy your internet session. Time is ticking!</p>

      <div className="my-6 w-full bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center text-slate-400 mb-2">
            <ClockIcon className="w-5 h-5 mr-2"/>
            <span className="text-sm font-medium">TIME REMAINING</span>
        </div>
        <Timer initialSeconds={session.remainingTime} onTimeEnd={onLogout} />
      </div>

      <div className="w-full flex flex-col sm:flex-row gap-3">
        <button
            onClick={onAddTime}
            className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-all duration-300"
        >
            Add More Time
        </button>
        <button
            onClick={onLogout}
            className="w-full bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500 transition-all duration-300"
        >
            Logout
        </button>
      </div>
    </div>
  );
};

export default ConnectView;