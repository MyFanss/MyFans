'use client';

import { useState, useEffect, useRef } from 'react';
import { sendMessage, type Conversation, type Message } from '@/lib/api/messages';
import { getCsrfToken } from '@/lib/csrf';

interface MessageThreadProps {
  conversation: Conversation;
  initialMessages: Message[];
  messagesError: string | null;
}

export function MessageThread({ conversation, initialMessages, messagesError }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(messagesError);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const otherParticipant = conversation.participant2 || conversation.participant1;
  const otherParticipantName = otherParticipant?.displayName || otherParticipant?.username || 'User';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const messageContent = content;
    const idempotencyKey = crypto.randomUUID();
    setContent('');
    setIsSending(true);
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      const newMessage = await sendMessage(
        conversation.id,
        { content: messageContent, idempotencyKey },
        csrfToken,
      );
      setMessages((prev) => [...prev, newMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      if (errorMessage === 'Unauthorized') {
        setError('You must be signed in to send messages. Please sign in and try again.');
      } else {
        setError(errorMessage);
      }
      setContent(messageContent); // Restore content on error
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {otherParticipantName}
        </h2>
        {otherParticipant?.username && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            @{otherParticipant.username}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 text-sm">{messagesError}</p>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === conversation.participant1Id ? 'justify-start' : 'justify-end'
              }`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.senderId === conversation.participant1Id
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'bg-primary-600 text-white'
                }`}
              >
                <p className="text-sm break-words">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.senderId === conversation.participant1Id
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-primary-100'
                }`}>
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSending}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isSending || !content.trim()}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
