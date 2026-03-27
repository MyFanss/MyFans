'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ConsentState = boolean | null;

interface ConsentContextType {
    consent: ConsentState;
    acceptConsent: () => void;
    declineConsent: () => void;
    setConsent: (consent: boolean) => void;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

const CONSENT_KEY = 'telemetry_consent';

export function ConsentProvider({ children }: { children: React.ReactNode }) {
    const [consent, setConsentState] = useState<ConsentState>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem(CONSENT_KEY);
        if (stored !== null) {
            setConsentState(stored === 'true');
        }
    }, []);

    const setConsent = (newConsent: boolean) => {
        setConsentState(newConsent);
        localStorage.setItem(CONSENT_KEY, String(newConsent));
    };

    const acceptConsent = () => setConsent(true);
    const declineConsent = () => setConsent(false);

    // Prevent hydration mismatch by optionally not rendering children until mounted, 
    // but it's better to just render children and let the banner handle isMounted check.
    return (
        <ConsentContext.Provider value={{ consent, acceptConsent, declineConsent, setConsent }}>
            {children}
        </ConsentContext.Provider>
    );
}

export function useConsent() {
    const context = useContext(ConsentContext);
    if (context === undefined) {
        throw new Error('useConsent must be used within a ConsentProvider');
    }
    return context;
}
