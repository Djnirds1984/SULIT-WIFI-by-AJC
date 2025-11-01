import React, { useState } from 'react';
import Dashboard from './admin/Dashboard';
import VoucherManager from './admin/VoucherManager';
import Settings from './admin/Settings';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { TicketIcon } from './icons/TicketIcon';
import { CogIcon } from './icons/CogIcon';

type AdminTab = 'dashboard' | 'vouchers' | 'settings';

const AdminView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'vouchers':
        return <VoucherManager />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  };

  const TabButton = ({ tab, label, icon }: { tab: AdminTab, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
        activeTab === tab
          ? 'bg-indigo-600 text-white'
          : 'text-slate-300 hover:bg-slate-700'
      }`}
      aria-pressed={activeTab === tab}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center justify-center gap-2 p-1 mb-6 bg-slate-900/50 border border-slate-700 rounded-lg">
        <TabButton tab="dashboard" label="Dashboard" icon={<ChartBarIcon className="w-5 h-5" />} />
        <TabButton tab="vouchers" label="Vouchers" icon={<TicketIcon className="w-5 h-5" />} />
        <TabButton tab="settings" label="Settings" icon={<CogIcon className="w-5 h-5" />} />
      </div>

      <div className="min-h-[350px]">
        {renderTabContent()}
      </div>

      <button
        onClick={onExit}
        className="w-full mt-6 bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500 transition-all duration-300"
      >
        Exit Admin View
      </button>
    </div>
  );
};

export default AdminView;
