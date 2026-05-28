'use client';

import React, { useEffect, useState } from 'react';

type HealthStatus = 'ok' | 'degraded' | 'down' | 'loading' | 'offline';

interface HealthResponse {
    status: 'ok' | 'degraded' | 'down';
    timestamp: string;
    components: {
        database: 'up' | 'down';
        soroban: 'up' | 'down';
    };
}

export const NetworkStatus: React.FC = () => {
    const [status, setStatus] = useState<HealthStatus>('loading');

    const fetchStatus = async () => {
        try {
            // Using a relative URL - assuming proxy is configured or base URL is handled
            const response = await fetch('/api/v1/health');
            if (!response.ok) {
                throw new Error('Health check failed');
            }
            const data: HealthResponse = await response.json();
            setStatus(data.status);
        } catch (error) {
            setStatus('offline');
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const getStatusConfig = (s: HealthStatus) => {
        switch (s) {
            case 'ok':
                return { color: '#22c55e', label: 'System Operational' }; // green-500
            case 'degraded':
                return { color: '#eab308', label: 'Degraded Performance' }; // yellow-500
            case 'down':
                return { color: '#ef4444', label: 'Service Offline' }; // red-500
            case 'offline':
                return { color: '#6b7280', label: 'Connection Lost' }; // gray-500
            case 'loading':
            default:
                return { color: '#94a3b8', label: 'Checking Status...' }; // slate-400
        }
    };

    const config = getStatusConfig(status);

    return (
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors">
            <div
                className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
                style={{ backgroundColor: config.color }}
                aria-hidden="true"
            />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                {config.label}
            </span>
        </div>
    );
};

export default NetworkStatus;
