import React from 'react';

// Using a similar icon for Memory Chip
const MemoryChipIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M15.75 5.25a3 3 0 013 3v9a3 3 0 01-3-3h-9a3 3 0 01-3-3v-9a3 3 0 013-3h9z"
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 7.5h.008v.008H15V7.5zm0 2.25h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm-2.25-4.5h.008v.008H12.75V7.5zm0 2.25h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm-2.25-4.5h.008v.008H10.5V7.5zm0 2.25h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008z"
        />
    </svg>
);

export default MemoryChipIcon;
