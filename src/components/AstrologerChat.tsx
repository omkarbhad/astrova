import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Bot, User, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { apiRequest } from '../config/api';
import type { KundaliResponse } from '../types/kundali';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AstrologerChatProps {
  kundaliData: KundaliResponse | null;
  chartName?: string;
}

const QUICK_PROMPTS = [
  { label: 'Overview', prompt: 'Give me a full overview of my birth chart' },
  { label: 'Career', prompt: 'What does my chart say about my career?' },
  { label: 'Relationships', prompt: 'Tell me about love and marriage in my chart' },
  { label: 'Health', prompt: 'What are the health indicators in my chart?' },
  { label: 'Dasha', prompt: 'Analyze my current dasha period' },
  { label: 'Planets', prompt: 'Show me my planetary strengths' },
  { label: 'Houses', prompt: 'Analyze my house strengths' },
  { label: 'Remedies', prompt: 'What remedies do you suggest?' },
];

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-3">')
    .replace(/\n- /g, '</p><li class="ml-4 list-disc text-neutral-300">')
    .replace(/\n/g, '<br/>');
}

export function AstrologerChat({ kundaliData, chartName }: AstrologerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  }, [messages.length]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(apiRequest('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText.trim(),
          kundali_data: kundaliData || null,
          chart_name: chartName || null,
          conversation_history: history,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I could not generate a response. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure the backend is running and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/60 border border-neutral-700/50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Vedic Astrologer</h3>
            <p className="text-neutral-400 text-xs">
              {kundaliData ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Chart loaded{chartName ? ` — ${chartName}` : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                  No chart loaded — generate one first
                </span>
              )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="gap-1.5 bg-neutral-800/50 border-neutral-700/50 text-neutral-400 hover:text-white hover:bg-neutral-800 h-8 px-2.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Clear</span>
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-neutral-950/40 border-x border-neutral-700/50 px-4 py-4 space-y-4 relative scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-neutral-700/50 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-violet-400/60" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">Vedic Astrologer</h3>
            <p className="text-neutral-400 text-sm mb-6 max-w-sm">
              {kundaliData
                ? 'Ask me anything about your birth chart — career, relationships, health, dasha periods, and more.'
                : 'Generate or load a birth chart first, then ask me about your astrological insights.'}
            </p>

            {kundaliData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => sendMessage(qp.prompt)}
                    className="px-3 py-2.5 rounded-xl bg-neutral-900/60 border border-neutral-700/50 text-neutral-300 text-xs font-medium hover:bg-neutral-800/60 hover:border-neutral-600/50 hover:text-white transition-all duration-200"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-white/10 border border-white/10 text-white'
                      : 'bg-neutral-900/60 border border-neutral-700/50 text-neutral-300'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none [&_strong]:text-white [&_li]:text-neutral-300"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                    />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-neutral-400" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-violet-400" />
                </div>
                <div className="bg-neutral-900/60 border border-neutral-700/50 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                    <span className="text-neutral-400 text-sm">Analyzing your chart...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}

        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700/50 flex items-center justify-center hover:bg-neutral-700 transition-colors shadow-lg"
          >
            <ChevronDown className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Quick Prompts Bar (when chat has messages) */}
      {messages.length > 0 && kundaliData && (
        <div className="flex gap-1.5 px-4 py-2 bg-neutral-900/40 border-x border-neutral-700/50 overflow-x-auto scrollbar-thin">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => sendMessage(qp.prompt)}
              disabled={isLoading}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-800/50 border border-neutral-700/50 text-neutral-400 text-xs hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3 bg-neutral-900/60 border border-neutral-700/50 rounded-b-2xl"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={kundaliData ? 'Ask about your birth chart...' : 'Load a chart first to start chatting...'}
          disabled={isLoading || !kundaliData}
          rows={1}
          className="flex-1 bg-neutral-800/50 border border-neutral-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600/80 focus:bg-neutral-800/70 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] max-h-[120px]"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim() || !kundaliData}
          className="h-10 w-10 p-0 rounded-xl bg-violet-600 hover:bg-violet-500 border-0 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
