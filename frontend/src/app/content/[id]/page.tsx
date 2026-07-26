import { notFound } from 'next/navigation';
import { getContentById } from '@/lib/api/content';
import Link from 'next/link';
import { ClientContent } from './client-content';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentPage({ params }: PageProps) {
  const { id } = await params;
  const content = await getContentById(id);

  if (!content) {
    notFound();
  }
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation placeholder */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <ClientContent content={content} />
      </main>
    </div>
  );
}
