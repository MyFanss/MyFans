import Link from 'next/link';
import { listConversations, type Conversation } from '@/lib/api/messages';

export default async function MessagesPage() {
  let conversations: Conversation[] = [];
  let error: string | null = null;
  let errorType: 'unauthorized' | 'notfound' | 'server' | null = null;

  try {
    const result = await listConversations({ limit: 20 });
    conversations = result.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load conversations';
    error = message;
    if (message.includes('401')) {
      errorType = 'unauthorized';
    } else if (message.includes('404')) {
      errorType = 'notfound';
    } else if (message.includes('5')) {
      errorType = 'server';
    }
  }

  const getOtherParticipant = (conv: Conversation) => {
    return conv.participant2?.username || conv.participant1?.username || 'Unknown';
  };

  const getOtherParticipantName = (conv: Conversation) => {
    return conv.participant2?.displayName || conv.participant2?.username || 'Unknown';
  };

  const getLastMessagePreview = (conv: Conversation) => {
    if (!conv.lastMessage) return 'No messages yet';
    const content = conv.lastMessage.content;
    return content.length > 50 ? `${content.slice(0, 50)}...` : content;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </Link>
            <div className="flex gap-4">
              <Link href="/games" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900">
                Games
              </Link>
              <Link href="/messages" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Messages
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Messages</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">
                {errorType === 'unauthorized'
                  ? 'You must be signed in to view messages. Please sign in to continue.'
                  : errorType === 'server'
                    ? 'We encountered an issue loading your conversations. Please try again later.'
                    : error}
              </p>
            </div>
          )}

          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-2">No conversations yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Start a conversation with creators you follow</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {getOtherParticipantName(conversation)}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {getLastMessagePreview(conversation)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
