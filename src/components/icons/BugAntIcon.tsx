import React from 'react';

const BugAntIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor" 
        {...props}
    >
        <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M10.25 2.25h3.5m-3.5 0-2.25 2.25M10.25 2.25 12.5 4.5M13.75 2.25l2.25 2.25m-2.25-2.25L11.5 4.5m3.75 4.5a3.75 3.75 0 0 0-7.5 0h7.5zM12 18.75a3.75 3.75 0 0 0 3.75-3.75H8.25A3.75 3.75 0 0 0 12 18.75zM12 15V9" 
        />
        <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M3.75 12.75h-.75m18 0h.75m-14.25-6h-1.5m1.5 0V5.25m0 1.5L5.25 6m12 6.75h1.5m-1.5 0V5.25m0 1.5l3.75-1.5M4.5 17.25l-2.25 2.25m18-2.25 2.25 2.25M4.5 6.75 2.25 4.5m18 2.25L19.5 4.5" 
        />
    </svg>
);

export default BugAntIcon;