import React, { useState, useEffect } from 'react';
import { getDashboardStats, getSystemInfo, getNetworkInfo } from '../../services/wifiService';
import { WifiIcon } from '../icons/WifiIcon';
import { TicketIcon } from '../icons/TicketIcon';
import { UserGroupIcon } from '../icons/UserGroupIcon';
import { CpuChipIcon } from '../icons/CpuChipIcon';
import { MemoryChipIcon } from '../icons/MemoryChipIcon';
import { SdCardIcon } from '../icons/SdCardIcon';
import { ServerStackIcon } from '../icons/ServerStackIcon';
import { AdminDashboardStats, SystemInfo, NetworkInfo } from '../../types';

// FIX: Moved helper components outside the Dashboard component to prevent re-creation on each render.
// This stabilizes the component definitions and resolves the intermittent TypeScript errors regarding props.
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

// FIX: Typed SpecCard as a React.FC to correctly handle `children` and `key` props.
interface SpecCardProps {
    icon: React.ReactElement<any>;
    label: string | React.ReactNode;
}

const SpecCard: React.FC<SpecCardProps> = ({ icon, label, children }) => (
    <div className="bg-slate-900/50 p-4 rounded-lg flex gap-4">
         <div className="p-2 rounded-full bg-slate-800/50 h-fit">
            {React.cloneElement(icon, { className: 'w-6 h-6 text-indigo-400' })}
        </div>
        <div className="w-full">
            <div className="text-sm text-slate-400 font-semibold">{label}</div>
            <div className="mt-1">
                {children}
            </div>
        </div>
    </div>
);

const ProgressBar = ({ value, total, colorClass }: { value: number, total: number, colorClass: string}) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
         <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className={`${colorClass} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
        </div>
    )
}

const LoadingPlaceholder = () => <div className="text-center p-4 text-slate-400 text-sm">Loading...</div>;
const ErrorPlaceholder = ({ message }: { message: string }) => <div className="text-center p-4 text-red-400 text-sm">{message}</div>;

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<AdminDashboardStats | null>(null);
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
    
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [isSystemInfoLoading, setIsSystemInfoLoading] = useState(true);
    const [isNetworkInfoLoading, setIsNetworkInfoLoading] = useState(true);
    
    const [statsError, setStatsError] = useState<string | null>(null);
    const [systemInfoError, setSystemInfoError] = useState<string | null>(null);
    const [networkInfoError, setNetworkInfoError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            setIsStatsLoading(true);
            setStatsError(null);
            try {
                const statsData = await getDashboardStats();
                setStats(statsData);
            } catch (error) {
                console.error("Failed to fetch stats", error);
                setStatsError("Could not load system stats.");
            } finally {
                setIsStatsLoading(false);
            }
        };

        const fetchSystemInfo = async () => {
            setIsSystemInfoLoading(true);
            setSystemInfoError(null);
            try {
                const systemInfoData = await getSystemInfo();
                setSystemInfo(systemInfoData);
            } catch (error) {
                console.error("Failed to fetch system info", error);
                setSystemInfoError("Could not load hardware information.");
            } finally {
                setIsSystemInfoLoading(false);
            }
        };
        
        const fetchNetworkInfo = async () => {
            setIsNetworkInfoLoading(true);
            setNetworkInfoError(null);
            try {
                const networkInfoData = await getNetworkInfo();
                setNetworkInfo(networkInfoData);
            } catch (error) {
                console.error("Failed to fetch network info", error);
                setNetworkInfoError("Could not load network information.");
            } finally {
                setIsNetworkInfoLoading(false);
            }
        };

        fetchStats();
        fetchSystemInfo();
        fetchNetworkInfo();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in-slow">
            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-4">System Status</h3>
                {isStatsLoading ? <LoadingPlaceholder /> : statsError ? <ErrorPlaceholder message={statsError} /> : stats && (
                    <div className="space-y-4">
                        <StatCard icon={<UserGroupIcon />} label="Active Sessions" value={stats.activeSessions} color="#818cf8" />
                        <StatCard icon={<TicketIcon />} label="Vouchers Used" value={stats.totalVouchersUsed} color="#60a5fa" />
                        <StatCard icon={<WifiIcon />} label="Vouchers Available" value={stats.totalVouchersAvailable} color="#4ade80" />
                    </div>
                )}
            </div>

            <div>
                 <h3 className="text-xl font-bold text-indigo-400 mb-4">Hardware Information</h3>
                 {isSystemInfoLoading ? <LoadingPlaceholder /> : systemInfoError ? <ErrorPlaceholder message={systemInfoError} /> : systemInfo && (
                    <div className="space-y-4">
                        <SpecCard icon={<CpuChipIcon />} label="CPU">
                            <p className="text-md font-bold text-white truncate">{systemInfo.cpu.model}</p>
                            <p className="text-xs text-slate-400">{systemInfo.cpu.cores}-Core Processor</p>
                        </SpecCard>
                         <SpecCard icon={<MemoryChipIcon />} label="RAM Usage">
                            <p className="text-sm font-bold text-white mb-2">{systemInfo.ram.usedMb} MB / {systemInfo.ram.totalMb} MB</p>
                            <ProgressBar value={systemInfo.ram.usedMb} total={systemInfo.ram.totalMb} colorClass="bg-sky-500" />
                        </SpecCard>
                         <SpecCard icon={<SdCardIcon />} label="SD Card Usage">
                            <p className="text-sm font-bold text-white mb-2">{(systemInfo.disk.usedMb / 1024).toFixed(1)} GB / {(systemInfo.disk.totalMb / 1024).toFixed(1)} GB</p>
                            <ProgressBar value={systemInfo.disk.usedMb} total={systemInfo.disk.totalMb} colorClass="bg-emerald-500" />
                        </SpecCard>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-xl font-bold text-indigo-400 mb-4">Network Interfaces</h3>
                {isNetworkInfoLoading ? <LoadingPlaceholder /> : networkInfoError ? <ErrorPlaceholder message={networkInfoError} /> : networkInfo && (
                    <div className="space-y-4">
                        {networkInfo.map(iface => (
                            <SpecCard key={iface.name} icon={<ServerStackIcon />} label={
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${iface.status === 'UP' ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                                    <p className="text-md font-bold text-white truncate">{iface.name}</p>
                                </div>
                            }>
                                <div className="text-xs text-slate-300 font-mono space-y-1">
                                    {iface.ip4 && <p>IPv4: {iface.ip4}</p>}
                                    {iface.ip6 && <p>IPv6: {iface.ip6}</p>}
                                    {!iface.ip4 && !iface.ip6 && <p className="text-slate-500">No IP addresses assigned</p>}
                                </div>
                            </SpecCard>
                        ))}
                         {networkInfo.length === 0 && <p className="text-center text-sm text-slate-500 py-4">No network interfaces found.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;