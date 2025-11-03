import React from 'react';

const ClipboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M9 5.25v-1.5A2.25 2.25 0 0111.25 1.5h1.5A2.25 2.25 0 0115 3.75v1.5m-5.625 0H18a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0118 20.25H6.75A2.25 2.25 0 014.5 18V7.5a2.25 2.25 0 012.25-2.25H9.375"
        />
    </svg>
);

export default ClipboardIcon;
