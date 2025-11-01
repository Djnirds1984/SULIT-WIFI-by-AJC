// FIX: Implemented the AdminView component with tabbed navigation.
import React, { useState } from 'react';
import Dashboard from './admin/Dashboard.tsx';
import VoucherManager from './admin/VoucherManager.tsx';
import Settings from './admin/Settings.tsx';
import { ChartBarIcon } from './icons/ChartBarIcon.tsx';
import { TicketIcon } from './icons/TicketIcon.tsx';
import { CogIcon } from './icons/CogIcon.tsx';

type AdminTab = 'DASHBOARD' | 'VOUCHERS' | 'SETTINGS';

const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'VOUCHERS':
                return <VoucherManager />;
            case 'SETTINGS':
                return <Settings />;
            case 'DASHBOARD':
            default:
                return <Dashboard />;
        }
    };

    const TabButton = ({ tab, label, icon }: { tab: AdminTab, label: string, icon: React.ReactNode }) => {
        const isActive = activeTab === tab;
        return (
            <button
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
            >
                {icon}
                <span className="hidden sm:inline">{label}</span>
            </button>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
                 <h2 className="text-2xl font-bold text-center text-indigo-400">Admin Panel</h2>
            </div>
            <div className="flex gap-2 p-1 mb-4 bg-slate-900/70 rounded-lg">
                <TabButton tab="DASHBOARD" label="Dashboard" icon={<ChartBarIcon className="w-5 h-5" />} />
                <TabButton tab="VOUCHERS" label="Vouchers" icon={<TicketIcon className="w-5 h-5" />} />
                <TabButton tab="SETTINGS" label="Settings" icon={<CogIcon className="w-5 h-5" />} />
            </div>

            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 min-h-[300px]">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default AdminView;