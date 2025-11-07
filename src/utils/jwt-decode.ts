import React from 'react';

// A simple, dependency-free JWT decoder for debugging purposes.
// IMPORTANT: This does NOT verify the signature. Do not use this for any security checks.
export const decodeJwt = (token: string): any => {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return { error: "Invalid JWT format" };
        
        // Pad the string with '=' characters to make it a valid base64 string
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const paddedBase64 = base64 + '===='.substring(pad);

        const jsonPayload = decodeURIComponent(atob(paddedBase64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode JWT:", e);
        return { error: "Failed to decode token. It might be malformed." };
    }
};