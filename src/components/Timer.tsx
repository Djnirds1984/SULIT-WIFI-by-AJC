import React, { useState, useEffect } from 'react';

interface TimerProps {
    initialRemainingTime: number;
    onExpire: () => void;
}

const formatTime = (seconds: number): string => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
};

const Timer: React.FC<TimerProps> = ({ initialRemainingTime, onExpire }) => {
    const [remaining, setRemaining] = useState(initialRemainingTime);

    useEffect(() => {
        setRemaining(initialRemainingTime);
    }, [initialRemainingTime]);

    useEffect(() => {
        if (remaining <= 0) {
            onExpire();
            return;
        }

        const interval = setInterval(() => {
            setRemaining(prev => prev - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [remaining, onExpire]);

    return (
        <div className="text-4xl font-bold text-center text-gray-800 tracking-wider">
            {formatTime(remaining)}
        </div>
    );
};

export default Timer;
