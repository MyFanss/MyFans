import type { ReactNode } from 'react';
import {
  buildRuntimeContractConfig,
  getContractIdLabel,
  getRuntimeContractConfigScript,
  type RuntimeContractConfig,
  validateRuntimeContractConfig,
} from '@/lib/contract-config';

interface ContractConfigBootstrapProps {
  children: ReactNode;
  config?: RuntimeContractConfig;
}

export function ContractConfigBootstrap({
  children,
  config = buildRuntimeContractConfig(),
}: ContractConfigBootstrapProps) {
  const validation = validateRuntimeContractConfig(config);
  const bootstrapScript = getRuntimeContractConfigScript(config);

  if (!validation.ok) {
    return (
      <>
        <script
          dangerouslySetInnerHTML={{ __html: bootstrapScript }}
          suppressHydrationWarning
        />
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Runtime Contract Config
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Contract configuration is incomplete
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              MyFans cannot start safely because required contract IDs are missing or invalid for this runtime environment.
            </p>

            <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Environment</p>
                <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{config.environment}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Network</p>
                <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{config.network}</p>
              </div>
            </div>

            {validation.missingIds.length > 0 && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Missing contract IDs
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-300">
                  {validation.missingIds.map((key) => (
                    <li key={key}>{getContractIdLabel(key)}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.invalidIds.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  Invalid contract IDs
                </p>
                <ul className="mt-2 space-y-1 text-sm text-red-800 dark:text-red-300">
                  {validation.invalidIds.map((key) => (
                    <li key={key}>{getContractIdLabel(key)}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
              Set the required <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">NEXT_PUBLIC_*</code> contract ID variables for this environment, then refresh the app.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: bootstrapScript }}
        suppressHydrationWarning
      />
      {children}
    </>
  );
}

export default ContractConfigBootstrap;
