import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/LoadingSpinner';

// Demo routes are only bundled/registered outside production builds.
// Preview and development environments keep demos enabled; production
// builds must never expose them. See docs/DEMO_ROUTES.md and
// scripts/check-demo-routes.mjs (enforced in CI).
const demosEnabled =
  import.meta.env.MODE !== 'production' || import.meta.env.VITE_ENABLE_DEMOS === 'true';

const WalletDemo = demosEnabled ? lazy(() => import('./pages/WalletDemo')) : null;
const ErrorTest = demosEnabled ? lazy(() => import('./pages/ErrorTest')) : null;
const UiShowcase = demosEnabled ? lazy(() => import('./pages/UiShowcase')) : null;
const SubscribeExample = demosEnabled ? lazy(() => import('./pages/SubscribeExample')) : null;
const SettingsDemo = demosEnabled ? lazy(() => import('./pages/SettingsDemo')) : null;

const Home = lazy(() => import('./pages/Home'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {demosEnabled && WalletDemo && (
            <Route path="wallet-demo" element={<WalletDemo />} />
          )}
          {demosEnabled && ErrorTest && (
            <Route path="error-test" element={<ErrorTest />} />
          )}
          {demosEnabled && UiShowcase && (
            <Route path="ui" element={<UiShowcase />} />
          )}
          {demosEnabled && SubscribeExample && (
            <Route path="subscribe-example" element={<SubscribeExample />} />
          )}
          {demosEnabled && SettingsDemo && (
            <Route path="settings-demo" element={<SettingsDemo />} />
          )}

          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
