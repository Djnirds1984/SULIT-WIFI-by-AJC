import React from 'react';

const ArchiveBoxIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.03 1.122 0 1.131.094 1.976 1.057 1.976 2.192V7.5m-9 0h9v9.75a1.5 1.5 0 01-1.5 1.5H9.75a1.5 1.5 0 01-1.5-1.5V7.5z"
        />
    </svg>
);

export default ArchiveBoxIcon;
