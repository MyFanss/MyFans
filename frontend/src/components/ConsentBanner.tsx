'use client';

import React, { useEffect, useState } from 'react';
import { useConsent } from '@/contexts/ConsentContext';

export function ConsentBanner() {
    const { consent, acceptConsent, declineConsent } = useConsent();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Show banner only if we are mounted and consent hasn't been given or denied yet
    if (!isMounted || consent !== null) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 border-t bg-background border-border shadow-lg">
            <div className="container flex flex-col items-center justify-between gap-4 mx-auto md:flex-row">
                <div className="text-sm text-center md:text-left text-muted-foreground">
                    <p>
                        We use continuous telemetry and analytics to improve our application.
                        By clicking "Accept", you consent to the use of telemetry. You can change your choice at any time in the Settings.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={declineConsent}
                        className="px-4 py-2 text-sm font-medium transition-colors border rounded-md text-foreground border-border hover:bg-muted"
                    >
                        Decline
                    </button>
                    <button
                        onClick={acceptConsent}
                        className="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
