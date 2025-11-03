import React, { useState, useEffect } from 'react';
import { getAdminStats, getSystemInfo } from '../../services/wifiService';
import { AdminStats, SystemInfo } from '../../types';
import UserGroupIcon from '../icons/UserGroupIcon';
import TicketIcon from '../icons/TicketIcon';
import CpuChipIcon from '../icons/CpuChipIcon';
import MemoryChipIcon from '../icons/MemoryChipIcon';
import SdCardIcon from '../icons/SdCardIcon';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.FC<any> }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
        <div className="bg-indigo-500 rounded-full p-3 mr-4 text-white">
            <Icon className="h-6 w-6" />
        </div>
        <div>
            <p className="text-sm text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);

const ProgressBar: React.FC<{ value: number; total: number; unit: string }> = ({ value, total, unit }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{`${value} ${unit}`}</span>
                <span>{`${total} ${unit}`}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                const [adminStats, sysInfo] = await Promise.all([getAdminStats(), getSystemInfo()]);
                setStats(adminStats);
                setSystemInfo(sysInfo);
            } catch (error: any) {
                console.error("Failed to load dashboard data", error);
                setError(error.message || "Could not load dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div>Loading dashboard...</div>;
    
    return (
        <div className="animate-fade-in space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Active Sessions" value={stats?.activeSessions ?? 'N/A'} icon={UserGroupIcon} />
                <StatCard title="Vouchers Used" value={stats?.totalVouchersUsed ?? 'N/A'} icon={TicketIcon} />
                <StatCard title="Vouchers Available" value={stats?.totalVouchersAvailable ?? 'N/A'} icon={TicketIcon} />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">System Status</h2>
                {systemInfo ? (
                    <div className="space-y-6">
                        <div>
                            <h3 className="font-medium text-gray-800 flex items-center mb-2"><CpuChipIcon className="h-5 w-5 mr-2" /> CPU</h3>
                            <p className="text-sm text-gray-600">{systemInfo.cpu.model} ({systemInfo.cpu.cores} cores)</p>
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-800 flex items-center mb-2"><MemoryChipIcon className="h-5 w-5 mr-2" /> RAM Usage</h3>
                            <ProgressBar value={systemInfo.ram.usedMb} total={systemInfo.ram.totalMb} unit="MB" />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-800 flex items-center mb-2"><SdCardIcon className="h-5 w-5 mr-2" /> Disk Usage</h3>
                            <ProgressBar value={systemInfo.disk.usedMb} total={systemInfo.disk.totalMb} unit="MB" />
                        </div>
                    </div>
                ) : <p>Could not load system information.</p>}
            </div>
        </div>
    );
};

export default Dashboard;
