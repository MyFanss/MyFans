/**
 * Analytics wrapper to send telemetry events only if the user has consented.
 */
export const analytics = {
    /**
     * Track an event.
     * @param eventName Name of the event
     * @param properties Optional extra properties associated with the event
     */
    trackEvent: (eventName: string, properties?: Record<string, any>) => {
        // Only fetch consent on the client side at the moment of tracking
        if (typeof window !== 'undefined') {
            const consent = window.localStorage.getItem('telemetry_consent');
            if (consent === 'true') {
                // Here you would normally send the event to your actual analytics provider (e.g. PostHog, Mixpanel, GA)
                // For demonstration purposes, we are logging it since no provider is configured yet.
                console.debug(`[Analytics] Track Event: ${eventName}`, properties || {});
            } else {
                // Do not track if consent is denied or not explicitly given
                console.debug(`[Analytics] Blocked Event (Consent not granted): ${eventName}`);
            }
        }
    },

    /**
     * Identify a user.
     * @param userId The unique ID of the user
     * @param userTraits Traits or properties of the user
     */
    identifyUser: (userId: string, userTraits?: Record<string, any>) => {
        if (typeof window !== 'undefined') {
            const consent = window.localStorage.getItem('telemetry_consent');
            if (consent === 'true') {
                console.debug(`[Analytics] Identify User: ${userId}`, userTraits || {});
            }
        }
    }
};
