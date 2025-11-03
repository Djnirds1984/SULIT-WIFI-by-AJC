import React from 'react';

const CpuChipIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5m1.5.75H12m6 0h-1.5m-1.5-.75V21m-6-18v1.5m-1.5.75H12m-6 0h1.5m1.5.75V3m6 18v-1.5m1.5.75H12m6 0h-1.5m-1.5-.75V21m-6-18v1.5m-1.5.75H12m-6 0h1.5m1.5.75V3"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 7.5h9v9h-9z"
        />
    </svg>
);

export default CpuChipIcon;
