import React from 'react';

const CogIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.414-1.414M6.077 8.457l1.414 1.414m0 0L10.5 12m-2.01 2.01l-1.414 1.414M17.923 8.457l-1.414 1.414m0 0L13.5 12m2.01 2.01l1.414 1.414M12 6.75v.007v.007v.007v.007v.007"
        />
    </svg>
);

export default CogIcon;
