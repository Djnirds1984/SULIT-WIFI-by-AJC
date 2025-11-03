import React from 'react';

const WrenchScrewdriverIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.471-2.471a.563.563 0 01.884 0l1.178 1.178a.563.563 0 010 .884l-2.471 2.471m-4.243-4.243L6.75 9.25l-1.414-1.414a.563.563 0 010-.884l1.178-1.178a.563.563 0 01.884 0l2.693 2.693M11.42 15.17l-4.243-4.243"
        />
    </svg>
);

export default WrenchScrewdriverIcon;
