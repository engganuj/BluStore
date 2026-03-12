import { useState, useRef, useEffect } from 'react';

// ── Sparkle icon ─────────────────────────────────────────────
const SparkleIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" />
  </svg>
);

// ── Canned demo responses ────────────────────────────────────
const DEMO_RESPONSES = {
  'Write a product description': `Here's a product description for your top-selling item:\n\n**Premium Organic Cotton T-Shirt**\n\nCrafted from 100% GOTS-certified organic cotton, this everyday essential delivers cloud-like softness with a conscience. The relaxed fit and reinforced seams ensure it holds up wash after wash.\n\n*Want me to adjust the tone or generate descriptions for other products?*`,

  'Analyze my recent sales': `Here's a snapshot of your store performance:\n\n**Last 30 days**\n- Revenue: **$4,280** (+12% vs prior period)\n- Orders: **64** (avg $66.88 per order)\n- Top product: *Organic Cotton T-Shirt* (23 units)\n- Returning customers: **38%**\n\nYour weekday sales are 2x stronger than weekends. Consider running a weekend-only promo to even things out.\n\n*Want me to dig deeper into any of these metrics?*`,

  'Create a holiday discount': `I'd suggest a tiered holiday promotion:\n\n**"Holiday Warmth" Campaign**\n- **HOLIDAY10** — 10% off orders over $50\n- **HOLIDAY20** — 20% off orders over $100\n- Valid: Dec 15 – Jan 2\n- Applies to all products except gift cards\n\nWant me to create these discount codes for you now?`,

  'Suggest pricing improvements': `Based on your product catalog and margins:\n\n1. **Organic Cotton T-Shirt** ($32) — Margin is 68%. Competitors average $35-40. You could raise to **$36** without impacting volume.\n\n2. **Linen Blend Shorts** ($48) — Your cost is $22 (54% margin). Consider bundling with a tee at **$72** (vs $80 separately) to boost AOV.\n\n3. **Accessories under $15** — These have only 40% margin. Consider a minimum price of **$18** or bundle them as add-ons.\n\n*Should I update any of these prices?*`,
};

const DEFAULT_RESPONSE = `I can help with that! Let me look into it for your store.\n\nIn a full integration, I'd pull your real store data and provide actionable recommendations. For now, try one of the suggested prompts to see what I can do.\n\n*This is a demo preview of BLU AI.*`;

// ── Typing indicator ─────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex justify-start px-4">
    <div className="px-4 py-2.5 rounded-2xl bg-white border border-[#E2E8F0]">
      <div className="flex gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] opacity-30 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

// ── Message bubble ───────────────────────────────────────────
const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';

  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <em key={j} className={isUser ? 'text-white/80' : 'text-[#94A3B8]'}>{part.slice(1, -1)}</em>;
        return part;
      });
      return <span key={i}>{i > 0 && <br />}{parts}</span>;
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] leading-[1.6] ${
          isUser
            ? 'bg-[#2563EB] text-white'
            : 'bg-white border border-[#E2E8F0] text-[#475569]'
        }`}
      >
        {renderText(message.text)}
      </div>
    </div>
  );
};

// ── Suggestion pill ──────────────────────────────────────────
const SuggestionPill = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors duration-150 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC]"
  >
    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#3B82F6]" />
    <span className="text-[13px] font-medium text-[#475569]">{text}</span>
  </button>
);

// ── Main Chat Panel ──────────────────────────────────────────
export default function BluAIChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = [
    'Write a product description',
    'Analyze my recent sales',
    'Create a holiday discount',
    'Suggest pricing improvements',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const simulateResponse = (userText) => {
    setIsTyping(true);
    const response = DEMO_RESPONSES[userText] || DEFAULT_RESPONSE;
    const delay = Math.min(600 + response.length * 3, 2000);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', text: response }]);
      setIsTyping(false);
    }, delay);
  };

  const handleSend = (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setShowSuggestions(false);
    simulateResponse(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleNewChat = () => {
    setMessages([]);
    setShowSuggestions(true);
    setInput('');
    setIsTyping(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="xl:hidden fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Chat panel */}
      <div
        className="fixed top-0 right-0 h-full w-full sm:w-[360px] flex flex-col bg-[#F8FAFC] border-l border-[#E2E8F0] z-50 xl:z-30"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E2E8F0]">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#EFF6FF] text-[#2563EB]">
            <SparkleIcon className="w-3.5 h-3.5" />
            BLU AI
          </span>
          <button
            onClick={handleNewChat}
            className="px-2 py-1 text-[12px] font-medium text-[#94A3B8] hover:text-[#475569] transition-colors"
          >
            + New
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Welcome state */}
          {showSuggestions && messages.length === 0 && (
            <div className="px-4 pt-8 pb-4">
              {/* Avatar */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-[#EFF6FF] border border-[#E2E8F0] mb-4">
                  <SparkleIcon className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#1E40AF]">
                  Hi there, let's grow your store.
                </h3>
                <p className="text-[12px] text-[#94A3B8] mt-1.5">
                  Here are some things you can ask me.
                </p>
              </div>

              {/* Suggestion pills */}
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <SuggestionPill key={s} text={s} onClick={handleSend} />
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="py-4 space-y-3">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 pb-3 pt-2">
          <div className="rounded-xl bg-white border border-[#E2E8F0] overflow-hidden focus-within:border-[#2563EB] transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="w-full px-4 pt-3 pb-1.5 text-[13px] text-[#475569] placeholder-[#94A3B8] outline-none bg-transparent"
            />
            <div className="flex items-center justify-between px-2.5 pb-2.5">
              {/* Attachment */}
              <button className="p-1.5 rounded-full text-[#94A3B8] hover:text-[#2563EB] transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              {/* Send */}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={`p-1.5 rounded-full transition-colors ${
                  input.trim() ? 'text-[#2563EB] cursor-pointer' : 'text-[#E2E8F0] cursor-default'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-center mt-2 text-[11px] text-[#94A3B8]">
            AI can make mistakes. Always double-check the results.
          </p>
        </div>
      </div>
    </>
  );
}
