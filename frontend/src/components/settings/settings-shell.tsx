import Link from "next/link";

export interface SettingsNavItem {
  id: string;
  label: string;
}

interface SettingsShellProps {
  role: "creator" | "fan";
  navItems: SettingsNavItem[];
  activeSectionId: string;
  onSectionChange: (sectionId: string) => void;
  onRoleChange: (role: "creator" | "fan") => void;
  children: React.ReactNode;
}

export function SettingsShell({
  role,
  navItems,
  activeSectionId,
  onSectionChange,
  onRoleChange,
  children,
}: SettingsShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 px-2 pb-8 pt-6 text-slate-900 dark:text-slate-100 sm:px-6 sm:pt-14 lg:px-8 lg:pt-16">
      <main className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm sm:rounded-3xl">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-700 px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                MyFans
              </p>
              <h1 className="mt-1 text-xl font-semibold sm:text-3xl">
                Settings
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Manage profile, wallet, notifications, and account access.
              </p>
            </div>
            <Link
              className="inline-flex w-fit items-center rounded-full border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white"
              href="/"
            >
              Back to home
            </Link>
          </div>
        </header>

        {/* Role switcher */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-3 ${
                role === "creator"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
              onClick={() => onRoleChange("creator")}
              type="button"
            >
              Creator Settings
            </button>
            <button
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-3 ${
                role === "fan"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
              onClick={() => onRoleChange("fan")}
              type="button"
            >
              Fan Settings
            </button>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="grid gap-0 overflow-hidden md:grid-cols-[220px_1fr]">
          {/* Sidebar nav */}
          <aside className="border-b border-slate-200 dark:border-slate-700 p-3 md:border-b-0 md:border-r md:p-4">
            {/* Mobile: horizontally scrollable pill row */}
            <nav className="flex flex-row flex-nowrap gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
              {navItems.map((item) => (
                <button
                  className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition md:w-full ${
                    activeSectionId === item.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
                  }`}
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="min-w-0 w-full overflow-hidden p-3 sm:p-6 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
