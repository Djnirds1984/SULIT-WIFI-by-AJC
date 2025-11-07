import React, { useState } from 'react';

// Import components for different pages
import Dashboard from './admin/Dashboard';
import VoucherManager from './admin/VoucherManager';
import Settings from './admin/Settings';
import Updater from './admin/Updater';
import Network from './admin/Network';
import PortalEditor from './admin/PortalEditor';
import DebugInfo from './admin/Debug';

// Import icons
import ChartBarIcon from './icons/ChartBarIcon';
import TicketIcon from './icons/TicketIcon';
import WrenchScrewdriverIcon from './icons/WrenchScrewdriverIcon';
import CloudArrowDownIcon from './icons/CloudArrowDownIcon';
import ServerStackIcon from './icons/ServerStackIcon';
import CodeBracketIcon from './icons/CodeBracketIcon';
import BugAntIcon from './icons/BugAntIcon';

interface AdminViewProps {
    onLogout: () => void;
}

const NavLink: React.FC<{ href: string; icon: React.FC<any>; children: React.ReactNode }> = ({ href, icon: Icon, children }) => {
    const currentPath = window.location.pathname;
    const isActive = currentPath === href || (currentPath === '/admin' && href === '/admin/dashboard');
    return (
        <a href={href} className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-indigo-500 hover:text-white'}`}>
            <Icon className="mr-3 h-6 w-6" />
            {children}
        </a>
    );
};

const AdminView: React.FC<AdminViewProps> = ({ onLogout }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const renderContent = () => {
        const path = window.location.pathname;
        if (path.startsWith('/admin/vouchers')) return <VoucherManager />;
        if (path.startsWith('/admin/settings')) return <Settings />;
        if (path.startsWith('/admin/updater')) return <Updater />;
        if (path.startsWith('/admin/network')) return <Network />;
        if (path.startsWith('/admin/portal-editor')) return <PortalEditor />;
        if (path.startsWith('/admin/debug')) return <DebugInfo />;
        // Default to Dashboard
        return <Dashboard />;
    };

    const SidebarContent = () => (
        <>
            <div className="flex items-center justify-center h-16 bg-indigo-700">
                <span className="text-white font-bold text-xl">SULIT WIFI</span>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
                <NavLink href="/admin/dashboard" icon={ChartBarIcon}>Dashboard</NavLink>
                <NavLink href="/admin/vouchers" icon={TicketIcon}>Vouchers</NavLink>
                <NavLink href="/admin/network" icon={ServerStackIcon}>Network</NavLink>
                <NavLink href="/admin/portal-editor" icon={CodeBracketIcon}>Portal Editor</NavLink>
                <NavLink href="/admin/settings" icon={WrenchScrewdriverIcon}>Settings</NavLink>
                <NavLink href="/admin/updater" icon={CloudArrowDownIcon}>Updater &amp; Backup</NavLink>
                <NavLink href="/admin/debug" icon={BugAntIcon}>Debug Info</NavLink>
            </nav>
            <div className="p-4">
                <button
                    onClick={onLogout}
                    className="w-full text-left flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-300 hover:bg-indigo-500 hover:text-white"
                >
                    Logout
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Static sidebar for desktop */}
            <div className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-64">
                    <div className="flex flex-col h-0 flex-1 bg-indigo-800">
                        <SidebarContent />
                    </div>
                </div>
            </div>

            <div className="flex flex-col w-0 flex-1 overflow-hidden">
                {/* Mobile menu button */}
                 <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    >
                        <span className="sr-only">Open sidebar</span>
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>

                {/* Mobile sidebar */}
                 {isSidebarOpen && (
                    <div className="md:hidden">
                        <div className="fixed inset-0 flex z-40">
                             <div className="fixed inset-0">
                                <div className="absolute inset-0 bg-gray-600 opacity-75" onClick={() => setIsSidebarOpen(false)}></div>
                            </div>
                            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-indigo-800">
                                <div className="absolute top-0 right-0 -mr-12 pt-2">
                                    <button 
                                        onClick={() => setIsSidebarOpen(false)}
                                        className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                                    >
                                        <span className="sr-only">Close sidebar</span>
                                         <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <SidebarContent />
                            </div>
                            <div className="flex-shrink-0 w-14"></div>
                        </div>
                    </div>
                )}

                <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none p-6">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

export default AdminView;