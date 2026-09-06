import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../shared/types.js';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  currentUserName: string;
  currentSessionId?: string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = React.memo(({
  messages,
  onSendMessage,
  disabled = false,
  currentUserName,
  currentSessionId,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInput('');
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between">
        <h2>Room Chat</h2>
        <span className="text-xs font-semibold text-slate-400">
          {messages.length} messages
        </span>
      </div>

      <div ref={scrollRef} className="chat-panel" aria-label="Chat messages" role="log">
        {messages.length === 0 ? (
          <p className="text-xs italic text-slate-500">No messages yet. Say hello!</p>
        ) : (
          messages.map((item) => {
            // Identity is the server-issued session id; display names can collide.
            const isSelf = currentSessionId
              ? item.senderSessionId === currentSessionId
              : item.sender === currentUserName;
            const isSystem = item.color === 'system';
            return (
              <div
                key={item.id}
                className={`chat-message ${isSelf ? 'chat-self' : ''}`}
              >
                <div className="chat-meta">
                  <span className="font-semibold text-amber-300">
                    {item.sender}
                    {isSelf && ' (You)'}
                  </span>
                  <span>{new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className={`mt-1 text-sm ${isSystem ? 'italic text-amber-200/90' : 'text-slate-200'}`}>
                  {item.message}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-composer mt-3">
        <div className="flex gap-2">
          <input
            type="text"
            className="field flex-1 text-sm"
            placeholder={disabled ? 'Chat disabled' : 'Type a message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={180}
            disabled={disabled}
          />
          <button
            type="submit"
            className="action-button action-primary whitespace-nowrap text-sm"
            disabled={disabled || !input.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';
