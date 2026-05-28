/**
 * i18n string extraction groundwork.
 * All user-facing strings are defined here keyed by locale.
 * Switch locale by setting NEXT_PUBLIC_LOCALE env var or via context.
 */

export type Locale = 'en' | 'es';

const strings = {
  en: {
    // WalletConnect
    'wallet.connect': 'Connect Wallet',
    'wallet.connecting': 'Connecting…',
    'wallet.connected': 'Connected',
    'wallet.error.noFreighter': 'No address returned. Is Freighter installed?',
    'wallet.error.failed': 'Failed to connect wallet. Please try again.',

    // Subscribe page
    'subscribe.heading': 'Subscribe to Creators',
    'subscribe.findCreator': 'Find a Creator',
    'subscribe.inputLabel': 'Creator Stellar Address',
    'subscribe.button': 'Subscribe',
    'subscribe.button.loading': 'Subscribing…',
    'subscribe.success': '✓ Subscribed successfully!',
    'subscribe.error': 'Subscription failed. Please try again.',
    'subscribe.modal.title': 'Confirm Subscription',
    'subscribe.modal.confirm': 'Confirm',
    'subscribe.modal.cancel': 'Cancel',
    'subscribe.skipToMain': 'Skip to main content',

    // Unlock content
    'content.exclusive': 'Exclusive Content',
    'content.unlock': 'Unlock Content',
    'content.unlock.loading': 'Unlocking…',
    'content.unlocked': 'Content unlocked! Enjoy your exclusive access.',
    'content.subscriberOnly': 'This content is available to subscribers.',
    'content.unlock.error': 'Failed to unlock. Please try again.',

    // Creators page
    'creators.heading': 'Creator Dashboard',
    'creators.createPlan': 'Create Subscription Plan',
    'creators.asset': 'Asset (e.g., USDC address)',
    'creators.amount': 'Amount',
    'creators.interval': 'Interval (days)',
    'creators.createButton': 'Create Plan',

    // Error boundary
    'error.heading': 'Something went wrong',
    'error.unknown': 'An unexpected error occurred.',
    'error.retry': 'Try again',
    'error.goHome': 'Go home',

    // Skeletons
    'skeleton.loadingCreator': 'Loading creator',
    'skeleton.loadingCreators': 'Loading creators',
    'skeleton.loadingSubscription': 'Loading subscription',
    'skeleton.loadingSubscriptions': 'Loading subscriptions',
    'skeleton.loadingContent': 'Loading content',
    'skeleton.loading': 'Loading…',
  },
  es: {
    'wallet.connect': 'Conectar Billetera',
    'wallet.connecting': 'Conectando…',
    'wallet.connected': 'Conectado',
    'wallet.error.noFreighter': 'Sin dirección. ¿Está instalado Freighter?',
    'wallet.error.failed': 'Error al conectar. Inténtalo de nuevo.',

    'subscribe.heading': 'Suscribirse a Creadores',
    'subscribe.findCreator': 'Buscar un Creador',
    'subscribe.inputLabel': 'Dirección Stellar del Creador',
    'subscribe.button': 'Suscribirse',
    'subscribe.button.loading': 'Suscribiendo…',
    'subscribe.success': '✓ ¡Suscripción exitosa!',
    'subscribe.error': 'Error en la suscripción. Inténtalo de nuevo.',
    'subscribe.modal.title': 'Confirmar Suscripción',
    'subscribe.modal.confirm': 'Confirmar',
    'subscribe.modal.cancel': 'Cancelar',
    'subscribe.skipToMain': 'Saltar al contenido principal',

    'content.exclusive': 'Contenido Exclusivo',
    'content.unlock': 'Desbloquear Contenido',
    'content.unlock.loading': 'Desbloqueando…',
    'content.unlocked': '¡Contenido desbloqueado! Disfruta tu acceso exclusivo.',
    'content.subscriberOnly': 'Este contenido está disponible para suscriptores.',
    'content.unlock.error': 'Error al desbloquear. Inténtalo de nuevo.',

    'creators.heading': 'Panel del Creador',
    'creators.createPlan': 'Crear Plan de Suscripción',
    'creators.asset': 'Activo (ej. dirección USDC)',
    'creators.amount': 'Monto',
    'creators.interval': 'Intervalo (días)',
    'creators.createButton': 'Crear Plan',

    'error.heading': 'Algo salió mal',
    'error.unknown': 'Ocurrió un error inesperado.',
    'error.retry': 'Intentar de nuevo',
    'error.goHome': 'Ir al inicio',

    'skeleton.loadingCreator': 'Cargando creador',
    'skeleton.loadingCreators': 'Cargando creadores',
    'skeleton.loadingSubscription': 'Cargando suscripción',
    'skeleton.loadingSubscriptions': 'Cargando suscripciones',
    'skeleton.loadingContent': 'Cargando contenido',
    'skeleton.loading': 'Cargando…',
  },
} as const;

export type StringKey = keyof typeof strings.en;

export function t(key: StringKey, locale: Locale = 'en'): string {
  return (strings[locale] as Record<string, string>)[key] ?? strings.en[key] ?? key;
}

export const defaultLocale: Locale = 'en';
export const supportedLocales: Locale[] = ['en', 'es'];
