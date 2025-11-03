import React from 'react';
import PortalView from './components/PortalView';
import AdminLoginView from './components/AdminLoginView';
import AdminView from './components/AdminView';

const App: React.FC = () => {
    // Simple auth check. In a real app, you'd validate the token with the server.
    const [isAdmin, setIsAdmin] = React.useState<boolean>(() => !!localStorage.getItem('admin_token'));

    const path = window.location.pathname;

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setIsAdmin(false);
        // Redirect to admin login page
        window.location.href = '/admin';
    };

    if (path.startsWith('/admin')) {
        if (isAdmin) {
            return <AdminView onLogout={handleLogout} />;
        }
        return <AdminLoginView onLoginSuccess={() => setIsAdmin(true)} />;
    }

    return <PortalView />;
};

export default App;
