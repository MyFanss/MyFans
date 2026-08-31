import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getConversationById, listMessages, type Message } from '@/lib/api/messages';
import { MessageThread } from './message-thread';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MessageThreadPage({ params }: PageProps) {
  const { id } = await params;
  const conversation = await getConversationById(id);

  if (!conversation) {
    notFound();
  }

  let messages: Message[] = [];
  let messagesError: string | null = null;

  try {
    const result = await listMessages(id, { limit: 30 });
    messages = result.data;
  } catch (err) {
    messagesError = err instanceof Error ? err.message : 'Failed to load messages';
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </Link>
            <div className="flex gap-4">
              <Link href="/messages" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
                Back to Messages
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <MessageThread conversation={conversation} initialMessages={messages} messagesError={messagesError} />
        </div>
      </main>
    </div>
  );
}
