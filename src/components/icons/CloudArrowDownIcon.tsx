import React from 'react';

const CloudArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3.75 13.5a9 9 0 1116.5 0 9 9 0 01-16.5 0z"
        />
    </svg>
);

export default CloudArrowDownIcon;
