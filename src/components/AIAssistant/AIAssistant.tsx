import { useState, useEffect, useRef } from 'react';
import {
  FaRobot,
  FaTimes,
  FaPaperPlane,
  FaShoppingCart,
  FaSearch,
  FaArrowRight,
  FaCog,
  FaRedo,
  FaCheck,
  FaKey,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import type { Product } from '../../features/products/types';
import {
  checkGroqServerStatus,
  DEFAULT_GROQ_MODEL,
  GROQ_MODEL_OPTIONS,
  runGroqShoppingAgent,
  type GroqServerStatus,
  type LlmMessage,
  type ToolCallTrace,
} from '../../services/groqAgentService';

const STORAGE_KEY_API = 'ecommerce_groq_api_key';
const STORAGE_KEY_MODEL = 'ecommerce_groq_model';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  toolCalls?: ToolCallTrace[];
  products?: Product[];
  pendingConfirmation?: boolean;
  isError?: boolean;
  needsSetup?: boolean;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-1',
  sender: 'agent',
  text: "👋 Hi! I'm your AI Shopping Assistant powered by Groq LLM & WebMCP. Ask me anything about products, prices, your cart, or checkout!",
};

function readStoredValue(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);

  const [apiKey, setApiKey] = useState<string>(() => readStoredValue(STORAGE_KEY_API));
  const [draftApiKey, setDraftApiKey] = useState<string>(() => readStoredValue(STORAGE_KEY_API));
  const [selectedModel, setSelectedModel] = useState<string>(
    () => readStoredValue(STORAGE_KEY_MODEL) || DEFAULT_GROQ_MODEL
  );
  const [serverStatus, setServerStatus] = useState<GroqServerStatus>({
    configured: false,
    defaultModel: DEFAULT_GROQ_MODEL,
  });
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const llmHistoryRef = useRef<LlmMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasCustomEndpoint = Boolean((import.meta.env.VITE_GROQ_API_URL || '').trim());
  const isLlmReady = serverStatus.configured || Boolean(apiKey.trim()) || hasCustomEndpoint;

  useEffect(() => {
    let active = true;
    checkGroqServerStatus().then((status) => {
      if (!active) return;
      setServerStatus(status);
      if (!readStoredValue(STORAGE_KEY_MODEL) && status.defaultModel) {
        setSelectedModel(status.defaultModel);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, showSettings]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedKey = draftApiKey.trim();
    const cleanedModel = selectedModel.trim() || DEFAULT_GROQ_MODEL;
    setApiKey(cleanedKey);
    setSelectedModel(cleanedModel);
    writeStoredValue(STORAGE_KEY_API, cleanedKey);
    writeStoredValue(STORAGE_KEY_MODEL, cleanedModel);
    setShowSettings(false);
  };

  const handleClearApiKey = () => {
    setDraftApiKey('');
    setApiKey('');
    writeStoredValue(STORAGE_KEY_API, '');
  };

  const handleClearChat = () => {
    if (isProcessing) return;
    llmHistoryRef.current = [];
    setExpandedTraceId(null);
    setMessages([
      {
        ...INITIAL_WELCOME_MESSAGE,
        id: `welcome-${Date.now()}`,
      },
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend ?? input).trim();
    if (!queryText || isProcessing) return;

    setInput('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      let currentStatus = serverStatus;
      if (!isLlmReady) {
        currentStatus = await checkGroqServerStatus();
        setServerStatus(currentStatus);
      }

      const readyNow = currentStatus.configured || Boolean(apiKey.trim()) || hasCustomEndpoint;
      if (!readyNow) {
        setMessages((prev) => [
          ...prev,
          {
            id: `setup-${Date.now()}`,
            sender: 'agent',
            needsSetup: true,
            isError: true,
            text: 'Groq API key is not configured yet. Add GROQ_API_KEY=gsk_... to your .env.local file (for local dev proxy) or paste your Groq API key in Settings.',
          },
        ]);
        setShowSettings(true);
        return;
      }

      const result = await runGroqShoppingAgent({
        userPrompt: queryText,
        history: llmHistoryRef.current,
        config: {
          apiKey: apiKey.trim() || undefined,
          model: selectedModel.trim() || currentStatus.defaultModel || DEFAULT_GROQ_MODEL,
        },
      });

      llmHistoryRef.current = result.updatedHistory;

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: result.text,
        toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
        products: result.products.length > 0 ? result.products : undefined,
        pendingConfirmation: result.pendingConfirmation,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unexpected LLM error occurred.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          isError: true,
          needsSetup: errorMessage.toLowerCase().includes('api key'),
          text: `⚠️ ${errorMessage}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAdd = async (product: Product) => {
    await handleSend(`Confirm and add 1 × product #${product.id} ("${product.title}") to my cart.`);
  };

  const handleConfirmAction = async (confirmed: boolean) => {
    if (confirmed) {
      await handleSend('Yes, I confirm. Please proceed.');
    } else {
      await handleSend('No, cancel that action.');
    }
  };

  const isPresetModel = GROQ_MODEL_OPTIONS.some((opt) => opt.id === selectedModel);

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-full shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 transition-all flex items-center gap-3 font-semibold text-sm cursor-pointer border border-white/20"
          aria-label="Open AI Shopping Assistant"
        >
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLlmReady ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isLlmReady ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            ></span>
          </span>
          <FaRobot className="text-lg" />
          <span>AI Assistant (Groq + WebMCP)</span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[560px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-900 text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40 shrink-0">
                <FaRobot className="text-indigo-300 text-base" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm tracking-wide truncate">AI Shopping Agent</h3>
                <span
                  className={`text-[11px] flex items-center gap-1 truncate ${
                    isLlmReady ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  ● {isLlmReady ? `Groq (${selectedModel})` : 'Setup Groq API Key'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleClearChat}
                disabled={isProcessing}
                title="Reset conversation"
                className="text-gray-300 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                aria-label="Reset conversation"
              >
                <FaRedo size={13} />
              </button>
              <button
                onClick={() => setShowSettings((prev) => !prev)}
                title="Groq LLM Settings"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showSettings ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
                }`}
                aria-label="Groq LLM Settings"
              >
                <FaCog size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                aria-label="Close AI Assistant"
              >
                <FaTimes size={17} />
              </button>
            </div>
          </div>

          {/* Collapsible Settings Drawer */}
          {showSettings && (
            <form
              onSubmit={handleSaveSettings}
              className="p-3.5 bg-indigo-50/90 border-b border-indigo-100 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                  <FaKey className="text-indigo-600" /> Groq LLM Configuration
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    serverStatus.configured
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {serverStatus.configured ? 'Proxy .env Ready' : 'Client Key Mode'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">
                  Groq Model
                </label>
                <select
                  value={isPresetModel ? selectedModel : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      setSelectedModel(e.target.value);
                    }
                  }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {GROQ_MODEL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                  {!isPresetModel && <option value="__custom__">Custom: {selectedModel}</option>}
                </select>
                <input
                  type="text"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="Model ID (e.g. openai/gpt-oss-120b)"
                  className="mt-1.5 w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-gray-700">
                    Groq API Key {serverStatus.configured ? '(Optional override)' : ''}
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-indigo-600 hover:underline"
                  >
                    Get free key ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={draftApiKey}
                  onChange={(e) => setDraftApiKey(e.target.value)}
                  placeholder={
                    serverStatus.configured
                      ? 'Using server .env.local key (or paste gsk_... to override)'
                      : 'gsk_...'
                  }
                  className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {apiKey ? (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="text-[11px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear saved key
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-500">
                    Stored only in your browser localStorage
                  </span>
                )}
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {messages.map((msg, idx) => {
              const isLatestMessage = idx === messages.length - 1;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : msg.isError
                          ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-none'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {msg.needsSetup && (
                      <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="mt-2 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <FaCog size={11} />
                        <span>Open Groq Settings</span>
                      </button>
                    )}
                  </div>

                  {/* WebMCP Tool Execution Trace Badges */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[92%]">
                      {msg.toolCalls.map((tc) => {
                        const traceKey = `${msg.id}-${tc.id}`;
                        const isExpanded = expandedTraceId === traceKey;
                        return (
                          <div key={traceKey} className="w-full max-w-full">
                            <button
                              type="button"
                              onClick={() => setExpandedTraceId(isExpanded ? null : traceKey)}
                              className="text-[11px] font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded border border-indigo-100 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <span>⚡ WebMCP:</span>
                              <span className="font-bold">{tc.name}</span>
                              {isExpanded ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                            </button>
                            {isExpanded && (
                              <div className="mt-1 p-2 rounded-lg bg-gray-900 text-gray-100 text-[10px] font-mono overflow-x-auto max-h-40 space-y-1">
                                <div>
                                  <span className="text-indigo-300">input:</span>{' '}
                                  {JSON.stringify(tc.input)}
                                </div>
                                <div>
                                  <span className="text-emerald-300">output:</span>{' '}
                                  {JSON.stringify(tc.output)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Confirmation Quick Actions */}
                  {msg.pendingConfirmation && isLatestMessage && !isProcessing && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmAction(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium cursor-pointer transition-colors"
                      >
                        <FaCheck size={10} />
                        <span>Confirm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmAction(false)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Inline Product Cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-2 space-y-2 w-full max-w-[95%]">
                      {msg.products.slice(0, 4).map((prod) => (
                        <div
                          key={prod.id}
                          className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 hover:border-blue-400 transition-colors"
                        >
                          <img
                            src={prod.image}
                            alt={prod.title}
                            className="w-12 h-12 object-contain rounded bg-white p-1 border"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{prod.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-bold text-gray-900">Rs.{prod.price}</span>
                              <span className="text-[11px] text-yellow-600">⭐ {prod.rating}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(prod)}
                            disabled={isProcessing}
                            className="bg-gray-900 hover:bg-blue-600 disabled:opacity-50 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <FaShoppingCart size={11} />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                </div>
                <span>Thinking with Groq LLM & WebMCP...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleSend('Show me Fit T-Shirts under Rs.30')}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <FaSearch size={10} /> Fit T-Shirts under 30
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleSend('What is in my cart?')}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <FaShoppingCart size={10} /> My Cart
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleSend('Proceed to checkout')}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <FaArrowRight size={10} /> Checkout
            </button>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-gray-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI agent (e.g. 'Best rated jackets under 60')..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors cursor-pointer"
              aria-label="Send message"
            >
              <FaPaperPlane size={13} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
