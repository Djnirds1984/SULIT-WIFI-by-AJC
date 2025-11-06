
import React, { useState, useEffect } from 'react';
import PortalView from './components/PortalView';
import AdminLoginView from './components/AdminLoginView';
import AdminView from './components/AdminView';

const App: React.FC = () => {
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    // This effect runs once on component mount to check for an existing token
    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (token) {
            // In a real app, you would validate the token with the server here.
            // For simplicity, we'll just assume it's valid if it exists.
            setIsAdmin(true);
        }
        setIsLoading(false);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setIsAdmin(false);
        // Redirect to admin login page to prevent being stuck on a protected page
        window.location.href = '/admin';
    };

    const handleLoginSuccess = () => {
        setIsAdmin(true);
        // Redirect to dashboard after successful login
        window.location.href = '/admin';
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    const path = window.location.pathname;

    if (path.startsWith('/admin')) {
        if (isAdmin) {
            return <AdminView onLogout={handleLogout} />;
        }
        return <AdminLoginView onLoginSuccess={handleLoginSuccess} />;
    }

    return <PortalView />;
};

export default App;
