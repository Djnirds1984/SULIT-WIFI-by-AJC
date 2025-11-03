import React from 'react';

const UserGroupIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.286 .94c-.622.58-1.352.924-2.147.924-1.449 0-2.733-.784-3.463-2.019a3.001 3.001 0 004.582-2.316m3.545 5.332a9.094 9.094 0 013.741-.479 3 3 0 01-4.682-2.72m-7.286 .94c.622.58 1.352.924 2.147.924 1.449 0 2.733-.784 3.463-2.019a3.001 3.001 0 01-4.582-2.316m0 0a3.001 3.001 0 00-3.445-2.592 3.001 3.001 0 00-2.592 3.445 3.001 3.001 0 002.316 4.582m0 0a3.001 3.001 0 003.445 2.592 3.001 3.001 0 002.592-3.445"
        />
    </svg>
);

export default UserGroupIcon;
