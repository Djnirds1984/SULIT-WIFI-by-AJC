import React from 'react';

const TicketIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M16.5 6.75h0"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 6.75h.75v.75h-.75zM16.5 9h0"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 9h.75v.75h-.75zM16.5 11.25h0"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 11.25h.75v.75h-.75zM16.5 13.5h0"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 13.5h.75v.75h-.75zM16.5 15.75h0"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 15.75h.75v.75h-.75z"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75h6v9H9z"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v10.5A2.25 2.25 0 0117.25 19.5H6.75A2.25 2.25 0 014.5 17.25V6.75z"
        />
    </svg>
);

export default TicketIcon;
