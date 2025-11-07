import React, { useState, useEffect } from 'react';
import { decodeJwt } from '../../utils/jwt-decode';

const DebugInfo: React.FC = () => {
    const [token, setToken] = useState<string | null>(null);
    const [decodedToken, setDecodedToken] = useState<any>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem('admin_token');
        setToken(storedToken);
        if (storedToken) {
            setDecodedToken(decodeJwt(storedToken));
        }
    }, []);

    const renderTokenInfo = () => {
        if (!token) {
            return <p className="text-gray-600">No token found in local storage. Please log in.</p>;
        }

        if (!decodedToken || decodedToken.error) {
            return <p className="text-red-500">Could not decode the token. It may be malformed.</p>;
        }
        
        const issuedAt = decodedToken.iat ? new Date(decodedToken.iat * 1000).toLocaleString() : 'N/A';
        const expiresAt = decodedToken.exp ? new Date(decodedToken.exp * 1000).toLocaleString() : 'N/A';
        const isExpired = decodedToken.exp ? new Date(decodedToken.exp * 1000) < new Date() : false;

        return (
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-gray-700">Decoded Token Payload:</h3>
                    <pre className="mt-1 p-3 bg-gray-100 rounded-md text-sm overflow-auto">
                        {JSON.stringify(decodedToken, null, 2)}
                    </pre>
                </div>
                 <div>
                    <h3 className="font-semibold text-gray-700">Token Details:</h3>
                    <ul className="list-disc list-inside mt-1 text-sm">
                        <li><strong>Issued At:</strong> {issuedAt}</li>
                        <li><strong>Expires At:</strong> {expiresAt}</li>
                        <li className={isExpired ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                            <strong>Status:</strong> {isExpired ? 'Expired' : 'Valid'}
                        </li>
                    </ul>
                </div>
                 <div>
                    <h3 className="font-semibold text-gray-700">Raw Token:</h3>
                     <textarea
                        readOnly
                        value={token}
                        className="mt-1 p-2 w-full h-32 bg-gray-100 rounded-md text-xs font-mono border-gray-300"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Debug Information</h1>
            
             <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="font-bold text-blue-800">About this page</p>
                <p className="text-sm text-blue-700">This page displays information about your current admin session token. It can help diagnose login issues related to token expiration or system clock problems on the server.</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Authentication Token Details</h2>
                {renderTokenInfo()}
            </div>
        </div>
    );
};

export default DebugInfo;