
import React, { useState, useEffect } from 'react';
import { getDashboardStats } from '../../services/wifiService.ts';
import { WifiIcon } from '../icons/WifiIcon.tsx';
import { TicketIcon } from '../icons/TicketIcon.tsx';
import { UserGroupIcon } from '../icons/UserGroupIcon.tsx';
import { AdminDashboardStats } from '../../types.ts';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<AdminDashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const data = await getDashboardStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    // FIX: Corrected the `icon` prop type to `React.ReactElement<any>`. The previous type `React.ReactElement` was too generic, causing a TypeScript error when cloning the element and adding a `className` prop.
    const StatCard = ({ icon, label, value, color }: { icon: React.ReactElement<any>, label: string, value: string | number, color: string }) => (
        <div className="bg-slate-900/50 p-4 rounded-lg flex items-center gap-4 border-l-4" style={{ borderColor: color }}>
            <div className={`p-2 rounded-full`} style={{ backgroundColor: `${color}20` }}>
                {React.cloneElement(icon, { className: 'w-6 h-6', style: { color } })}
            </div>
            <div>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </div>
    );

    if (isLoading) {
        return <div className="text-center p-8 text-slate-400">Loading dashboard...</div>;
    }
    
    if (!stats) {
        return <div className="text-center p-8 text-red-400">Could not load stats.</div>;
    }

    return (
        <div className="space-y-4 animate-fade-in-slow">
            <h3 className="text-xl font-bold text-indigo-400 mb-4">System Status</h3>
            <StatCard icon={<UserGroupIcon />} label="Active Sessions" value={stats.activeSessions} color="#818cf8" />
            <StatCard icon={<TicketIcon />} label="Vouchers Used" value={stats.totalVouchersUsed} color="#60a5fa" />
            <StatCard icon={<WifiIcon />} label="Vouchers Available" value={stats.totalVouchersAvailable} color="#4ade80" />
        </div>
    );
};

export default Dashboard;