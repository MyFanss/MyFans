import { redirect } from 'next/navigation';

/** Redirect /dashboard to /dashboard/plans by default. */
export default function DashboardIndexPage() {
  redirect('/dashboard/plans');
}
