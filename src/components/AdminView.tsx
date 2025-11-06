import React, { useState } from 'react';
import Dashboard from './admin/Dashboard';
import VoucherManager from './admin/VoucherManager';
import Settings from './admin/Settings';
import Network from './admin/Network';
import PortalEditor from './admin/PortalEditor';
import Updater from './admin/Updater';
import ChartBarIcon from './icons/ChartBarIcon';
import TicketIcon from './icons/TicketIcon';
import CogIcon from './icons/CogIcon';
import WrenchScrewdriverIcon from './icons/WrenchScrewdriverIcon';
import CodeBracketIcon from './icons/CodeBracketIcon';
import CloudArrowDownIcon from './icons/CloudArrowDownIcon';

interface AdminViewProps {
    onLogout: () => void;
}

type AdminPage = 'dashboard' | 'vouchers' | 'network' | 'editor' | 'updater' | 'settings';

const AdminView: React.FC<AdminViewProps> = ({ onLogout }) => {
    const [activePage, setActivePage] = useState<AdminPage>('dashboard');

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard': return <Dashboard />;
            case 'vouchers': return <VoucherManager />;
            case 'network': return <Network />;
            case 'editor': return <PortalEditor />;
            case 'updater': return <Updater />;
            case 'settings': return <Settings />;
            default: return <Dashboard />;
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
        { id: 'vouchers', label: 'Vouchers', icon: TicketIcon },
        { id: 'network', label: 'Network', icon: WrenchScrewdriverIcon },
        { id: 'updater', label: 'Updater & Backups', icon: CloudArrowDownIcon },
        { id: 'settings', label: 'System', icon: CogIcon },
        // { id: 'editor', label: 'Portal Editor', icon: CodeBracketIcon },
    ];

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <aside className="w-64 bg-gray-800 text-white flex flex-col flex-shrink-0">
                <div className="h-16 flex items-center justify-center text-xl font-bold border-b border-gray-700">
                    SULIT WIFI Admin
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {navItems.map(item => (
                         <button
                            key={item.id}
                            onClick={() => setActivePage(item.id as AdminPage)}
                            className={`w-full flex items-center px-4 py-2 text-left rounded-lg transition-colors duration-200 ${
                                activePage === item.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            <item.icon className="h-6 w-6 mr-3" />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="px-2 py-4">
                     <button
                        onClick={onLogout}
                        className="w-full flex items-center px-4 py-2 text-left rounded-lg text-gray-300 hover:bg-red-700 hover:text-white transition-colors duration-200"
                    >
                        Logout
                    </button>
                </div>
            </aside>
            <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
                {renderPage()}
            </main>
        </div>
    );
};

export default AdminView;