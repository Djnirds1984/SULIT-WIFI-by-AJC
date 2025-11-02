// FIX: Implemented the AdminView component with tabbed navigation.
import React, { useState } from 'react';
import Dashboard from './admin/Dashboard';
import VoucherManager from './admin/VoucherManager';
import Settings from './admin/Settings';
import Network from './admin/Network';
import Updater from './admin/Updater';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { TicketIcon } from './icons/TicketIcon';
import { CogIcon } from './icons/CogIcon';
import { CloudArrowDownIcon } from './icons/CloudArrowDownIcon';
import { WrenchScrewdriverIcon } from './icons/WrenchScrewdriverIcon';


type AdminTab = 'DASHBOARD' | 'VOUCHERS' | 'SETTINGS' | 'NETWORK' | 'UPDATER';

const AdminView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'VOUCHERS':
                return <VoucherManager />;
            case 'SETTINGS':
                return <Settings />;
            case 'NETWORK':
                return <Network />;
            case 'UPDATER':
                return <Updater />;
            case 'DASHBOARD':
            default:
                return <Dashboard />;
        }
    };

    const SidebarLink = ({ tab, label, icon }: { tab: AdminTab, label: string, icon: React.ReactNode }) => {
        const isActive = activeTab === tab;
        return (
            <button
                onClick={() => setActiveTab(tab)}
                className={`flex items-center w-full gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
            >
                {icon}
                <span>{label}</span>
            </button>
        );
    };

    return (
        <div className="animate-fade-in">
             <h2 className="text-2xl font-bold text-center text-indigo-400 mb-6">Admin Panel</h2>
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                <nav className="md:w-1/4 flex flex-row md:flex-col gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-700">
                    <SidebarLink tab="DASHBOARD" label="Dashboard" icon={<ChartBarIcon className="w-5 h-5" />} />
                    <SidebarLink tab="VOUCHERS" label="Vouchers" icon={<TicketIcon className="w-5 h-5" />} />
                    <SidebarLink tab="SETTINGS" label="Settings" icon={<CogIcon className="w-5 h-5" />} />
                    <SidebarLink tab="NETWORK" label="Network" icon={<WrenchScrewdriverIcon className="w-5 h-5" />} />
                    <SidebarLink tab="UPDATER" label="Updater" icon={<CloudArrowDownIcon className="w-5 h-5" />} />
                </nav>

                <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-4 md:p-6 min-h-[400px]">
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default AdminView;