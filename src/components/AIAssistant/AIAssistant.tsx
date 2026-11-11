import { useState, useEffect, useRef } from 'react';
import { FaRobot, FaTimes, FaPaperPlane, FaShoppingCart, FaSearch, FaArrowRight } from 'react-icons/fa';
import { webMCPRegistry } from '../../webmcp/registry';
import type { Product } from '../../features/products/types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  toolCall?: {
    name: string;
    input: any;
    output: any;
  };
  products?: Product[];
  actionType?: 'add_to_cart' | 'checkout';
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'agent',
      text: "👋 Hi! I'm your AI Shopping Assistant powered by WebMCP. Tell me what you're looking for, or try one of the quick suggestions below!",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Agent Intent Resolver that executes tools via WebMCP
  const processAgentRequest = async (userPrompt: string) => {
    const promptLower = userPrompt.toLowerCase();
    let replyText = '';
    let toolCallInfo: ChatMessage['toolCall'] | undefined;
    let productsList: Product[] | undefined;

    try {
      // 1. Intent: Search / Filter (e.g. "Fit T-Shirts under 30", "jacket under 60", "jewelery")
      if (
        promptLower.includes('find') ||
        promptLower.includes('search') ||
        promptLower.includes('show') ||
        promptLower.includes('look for') ||
        promptLower.includes('t-shirt') ||
        promptLower.includes('jacket') ||
        promptLower.includes('backpack') ||
        promptLower.includes('jewel') ||
        promptLower.includes('under')
      ) {
        // Extract maxPrice if specified (e.g. "under 30", "< 50")
        const priceMatch = promptLower.match(/under\s+(?:rs\.?|\$)?\s*(\d+)/i) || promptLower.match(/<=\s*(\d+)/);
        const maxPrice = priceMatch ? Number(priceMatch[1]) : undefined;

        // Clean query terms
        let cleanQuery = userPrompt
          .replace(/show\s+me/gi, '')
          .replace(/find/gi, '')
          .replace(/search\s+for/gi, '')
          .replace(/under\s+(?:rs\.?|\$)?\s*\d+/gi, '')
          .replace(/like/gi, '')
          .replace(/please/gi, '')
          .trim();

        if (!cleanQuery && maxPrice) cleanQuery = '';

        const toolName = maxPrice && !cleanQuery ? 'filter_products' : 'search_products';
        const toolInput = toolName === 'search_products'
          ? { query: cleanQuery || 'a', maxPrice }
          : { maxPrice };

        const result = await webMCPRegistry.executeTool(toolName, toolInput);
        toolCallInfo = { name: toolName, input: toolInput, output: result };

        if (result?.products && result.products.length > 0) {
          productsList = result.products;
          replyText = `Found ${result.products.length} product(s) matching your request:`;
        } else {
          replyText = `Sorry, no products found matching "${userPrompt}". Try a different keyword or price range.`;
        }
      }
      // 2. Intent: View Cart (e.g. "what's in my cart", "cart total", "view cart")
      else if (promptLower.includes('cart') && !promptLower.includes('add')) {
        const result = await webMCPRegistry.executeTool('get_cart', {});
        toolCallInfo = { name: 'get_cart', input: {}, output: result };

        if (result?.itemCount > 0) {
          replyText = `Your cart has ${result.itemCount} item(s) totaling Rs.${result.totalAmount}.`;
        } else {
          replyText = 'Your shopping cart is currently empty! Would you like me to recommend something?';
        }
      }
      // 3. Intent: Add to Cart (e.g. "add to cart", "add product 2")
      else if (promptLower.includes('add') || promptLower.includes('buy')) {
        const idMatch = promptLower.match(/(?:product|id|#)?\s*(\d+)/);
        const productId = idMatch ? Number(idMatch[1]) : 2;

        const result = await webMCPRegistry.executeTool('add_to_cart', {
          productId,
          quantity: 1,
          confirmed: true,
        });
        toolCallInfo = { name: 'add_to_cart', input: { productId, quantity: 1, confirmed: true }, output: result };

        if (result?.success) {
          replyText = `✅ Added "${result.addedItem.title}" to your cart! Cart total is now Rs.${result.cartSummary.totalAmount}.`;
        } else {
          replyText = `Could not add product: ${result?.message || 'Error occurred'}`;
        }
      }
      // 4. Intent: Checkout
      else if (promptLower.includes('checkout') || promptLower.includes('pay')) {
        const result = await webMCPRegistry.executeTool('start_checkout', { confirmed: true });
        toolCallInfo = { name: 'start_checkout', input: { confirmed: true }, output: result };

        if (result?.success) {
          replyText = '🚀 Navigated to checkout! Please enter your shipping address and payment method on screen to complete your order.';
        } else {
          replyText = `Cannot checkout: ${result?.message || 'Your cart is empty'}`;
        }
      }
      // 5. Default General Query
      else {
        const result = await webMCPRegistry.executeTool('search_products', { query: userPrompt });
        toolCallInfo = { name: 'search_products', input: { query: userPrompt }, output: result };
        if (result?.products && result.products.length > 0) {
          productsList = result.products;
          replyText = `Found ${result.products.length} result(s):`;
        } else {
          replyText = `I can help you search products, manage your cart, or check out. What are you looking to buy today?`;
        }
      }
    } catch (err: any) {
      replyText = `Error communicating with WebMCP: ${err?.message || 'Execution error'}`;
    }

    return {
      text: replyText,
      toolCall: toolCallInfo,
      products: productsList,
    };
  };

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || isProcessing) return;

    setInput('');
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: queryText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await processAgentRequest(queryText);
      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: response.text,
        toolCall: response.toolCall,
        products: response.products,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAdd = async (productId: number) => {
    await handleSend(`Add product ${productId} to cart`);
  };

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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <FaRobot className="text-lg" />
          <span>AI Assistant (WebMCP)</span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-900 text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40">
                <FaRobot className="text-indigo-300 text-base" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">AI Shopping Agent</h3>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  ● WebMCP Connected
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <FaTimes size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* WebMCP Tool Trace Badge */}
                {msg.toolCall && (
                  <div className="mt-1 max-w-[90%] text-[11px] font-mono bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded border border-indigo-100 flex items-center gap-1.5">
                    <span>⚡ WebMCP Tool:</span>
                    <span className="font-bold">{msg.toolCall.name}</span>
                  </div>
                )}

                {/* Inline Product Cards */}
                {msg.products && msg.products.length > 0 && (
                  <div className="mt-2 space-y-2 w-full max-w-[95%]">
                    {msg.products.slice(0, 3).map((prod) => (
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
                          onClick={() => handleQuickAdd(prod.id)}
                          className="bg-gray-900 hover:bg-blue-600 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <FaShoppingCart size={11} />
                          <span>Add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                </div>
                <span>Executing WebMCP tool...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSend('Show me Fit T-Shirts under 30')}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
            >
              <FaSearch size={10} /> Fit T-Shirts under 30
            </button>
            <button
              onClick={() => handleSend('What is in my cart?')}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
            >
              <FaShoppingCart size={10} /> My Cart
            </button>
            <button
              onClick={() => handleSend('Proceed to checkout')}
              className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
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
              placeholder="Ask AI agent (e.g. 'Jackets under 60')..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <FaPaperPlane size={13} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
