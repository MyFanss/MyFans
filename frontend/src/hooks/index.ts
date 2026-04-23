// Form validation hook
export {
  useFormValidation,
  validationPatterns,
  createMatchRule,
  createMinRule,
  createMaxRule,
  type ValidationRule,
  type FieldConfig,
  type FormFieldsConfig,
  type FormValidationResult,
} from './useFormValidation';

// Transaction hook
export {
  useTransaction,
  useNetworkStatus,
  withTransactionHandling,
  type TransactionState,
  type TransactionOptions,
  type TransactionResult,
} from './useTransaction';

// Wallet hook
export { useWallet } from './useWallet';

// Onboarding hook
export { useOnboarding } from './useOnboarding';

export {
  useFanQuickstart,
  FAN_QUICKSTART_SUBSCRIBE_URL,
} from './useFanQuickstart';

// Favorites hook
export { FavoritesProvider, useFavorites } from './useFavorites';

// Clock skew hook (ledger time vs wall clock)
export {
  useClockSkew,
  ledgerSeqToUnix,
  ledgerNowUnix,
  type ClockSkew,
} from './useClockSkew';

// Creator route prefetch hook
export { usePrefetchCreatorRoute } from './usePrefetchCreatorRoute';
