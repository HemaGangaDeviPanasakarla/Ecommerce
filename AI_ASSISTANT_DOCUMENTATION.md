# AI Shopping Assistant: Technical Specification & Architecture Document

---

## 1. Overview & Purpose

The **AI Shopping Assistant** (`src/components/AIAssistant/AIAssistant.tsx`) is an in-browser conversational agent built directly into the React 19 application. 

It provides an interactive chat interface that translates human language (e.g., *"Show me Fit T-Shirts under 30"*) into standardized **WebMCP** tool calls, executing queries against the real catalog API and mutating the live **Redux** shopping cart in real time.

```
┌────────────────────────────────────────────────────────┐
│                   HUMAN SHOPPER                        │
│   Types: "Show me Fit T-Shirts under 30"               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             AI ASSISTANT (AIAssistant.tsx)             │
│   1. Receives natural language prompt                  │
│   2. Parses intent: Action = search, maxPrice = 30     │
│   3. Selects WebMCP tool: search_products              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│          WEBMCP LAYER (document.modelContext)          │
│   Invokes registered tool callback with input          │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  EXTERNAL BACKEND API    │  │       REDUX STORE        │
│  GET /products           │  │  cartSlice.tsx           │
│  (FakeStore API)         │  │  localStorage sync       │
└─────────────┬────────────┘  └────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌────────────────────────────────────────────────────────┐
│                    LIVE REACT UI                       │
│   • Header cart badge counter updates                  │
│   • Toast notification displays alert                  │
│   • In-chat interactive product card rendered          │
└────────────────────────────────────────────────────────┘
```

---

## 2. Component Structure & Architecture

The component lives in `src/components/AIAssistant/AIAssistant.tsx` and is structured into four functional layers:

```
src/components/AIAssistant/AIAssistant.tsx
├── 1. State Management
│   ├── isOpen: boolean (Controls drawer open/collapsed)
│   ├── input: string (Current user text entry)
│   ├── isProcessing: boolean (Disables input during tool execution)
│   └── messages: ChatMessage[] (Conversation history with tool traces)
│
├── 2. Intent Resolution Engine (processAgentRequest)
│   ├── Regex price extraction ("under 30", "< 50")
│   ├── Keyword normalization & cleaning
│   └── Intent-to-WebMCP tool mapping
│
├── 3. WebMCP Execution Bridge
│   ├── Calls webMCPRegistry.executeTool(toolName, parameters)
│   ├── Captures structured JSON output
│   └── Attaches tool execution trace to the message
│
└── 4. Interactive UI Presentation
    ├── Floating Action Button (with pulsing WebMCP status indicator)
    ├── Message Stream with Speech Bubbles
    ├── WebMCP Tool Trace Badge (⚡ WebMCP Tool: search_products)
    ├── Inline Product Cards (with quick "Add to Cart" buttons)
    ├── One-Click Prompt Chips
    └── Form Input with Submit Handler
```

---

## 3. How It Is Bound to the Application

The assistant is mounted inside the main application tree in `src/App.tsx`:

```tsx
export default function App() {
  return (
    <Provider store={store}>          {/* 1. Global Redux Store */}
      <Router>                        {/* 2. Client-side Navigation */}
        <WebMCPManager />             {/* 3. In-page WebMCP Registry */}
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow">
            <Routes> ... </Routes>
          </main>
          <Footer />
          <Cart />
          <AIAssistant />             {/* 4. AI Assistant Widget */}
          <ToastContainer />
        </div>
      </Router>
    </Provider>
  );
}
```

### Why this binding is critical:
* **Redux Synchronization**: The assistant triggers WebMCP tools that directly call `dispatch(addToCart(...))`. Redux subscribers (such as `Header.tsx` and `Cart.tsx`) immediately re-render when the assistant makes changes.
* **Router Access**: When the user requests checkout, the tool accesses React Router's `navigate('/checkout')` to change routes safely.
* **Persistent Storage**: Changes made through the assistant persist across page reloads because `cartSlice.tsx` writes directly to `localStorage['cartItems']`.

---

## 4. Intent Resolution: How the Assistant Understands Input

The assistant uses an **Intent Resolution Engine** (`processAgentRequest`) to evaluate user text, extract parameters, and select the corresponding WebMCP tool:

```typescript
// Step A: Extract numerical constraints (e.g. "under 30", "under Rs. 500")
const priceMatch = promptLower.match(/under\s+(?:rs\.?|\$)?\s*(\d+)/i) || 
                   promptLower.match(/<=\s*(\d+)/);
const maxPrice = priceMatch ? Number(priceMatch[1]) : undefined;

// Step B: Sanitize keyword queries
let cleanQuery = userPrompt
  .replace(/show\s+me/gi, '')
  .replace(/find/gi, '')
  .replace(/search\s+for/gi, '')
  .replace(/under\s+(?:rs\.?|\$)?\s*\d+/gi, '')
  .replace(/like/gi, '')
  .replace(/please/gi, '')
  .trim();

// Step C: Route to appropriate WebMCP tool
if (promptLower.includes('find') || promptLower.includes('under') || promptLower.includes('t-shirt')) {
  toolName = 'search_products';
  toolInput = { query: cleanQuery, maxPrice: maxPrice };
} else if (promptLower.includes('cart') && !promptLower.includes('add')) {
  toolName = 'get_cart';
  toolInput = {};
} else if (promptLower.includes('add') || promptLower.includes('buy')) {
  toolName = 'add_to_cart';
  toolInput = { productId: 2, quantity: 1, confirmed: true };
} else if (promptLower.includes('checkout') || promptLower.includes('pay')) {
  toolName = 'start_checkout';
  toolInput = { confirmed: true };
}
```

---

## 5. Action Decision Matrix

| User Input Pattern | Classified Intent | Selected WebMCP Tool | Execution Handler | What Happens Behind the Scenes |
|---|---|---|---|---|
| *"Show me...", "Find...", "Fit T-Shirts under 30"* | Catalog Search | `search_products` | `productTools.ts` | Calls `GET /products` on FakeStore API $\rightarrow$ filters by title and `price <= 30` $\rightarrow$ renders product card in chat. |
| *"Tell me more about product 2"* | Product Detail | `get_product_details` | `productTools.ts` | Calls `GET /products/2` $\rightarrow$ retrieves full description, rating, and image. |
| *"What is in my cart?", "Cart total"* | Cart Query | `get_cart` | `cartTools.ts` | Reads `store.getState().cart.items` $\rightarrow$ calculates item subtotals $\rightarrow$ reports total in chat. |
| *"Add product 2 to cart"*, Click **"Add"** | Cart Mutation | `add_to_cart` | `cartTools.ts` | Fetches authentic price $\rightarrow$ dispatches Redux `addToCart` $\rightarrow$ increments header badge and triggers toast. |
| *"Update quantity of product 2 to 4"* | Quantity Update | `update_cart` | `cartTools.ts` | Dispatches Redux `updateQuantity({ id, quantity })`. |
| *"Remove product 2 from cart"* | Item Removal | `remove_from_cart` | `cartTools.ts` | Dispatches Redux `removeFromCart(id)`. |
| *"Proceed to checkout", "Buy now"* | Navigation | `start_checkout` | `checkoutTools.ts` | Verifies cart has items $\rightarrow$ executes `navigate('/checkout')` to load checkout form. |
| *"Apply coupon SAVE20"* | Promotion | `apply_coupon` | `checkoutTools.ts` | Safely returns `{ status: "UNAVAILABLE" }` because FakeStore API has no coupon endpoint. |

---

## 6. What API Calls Happen in the Background?

Real HTTP network requests are executed through the shared service layer `src/services/productService.ts`:

1. **Catalog Search / Filter**:
   * **Endpoint**: `GET https://fakestoreapi.com/products`
   * **Payload**: None
   * **Response**: Array of 20 products. The tool filters client-side matching the query keywords and price threshold.
   * *Verify in DevTools*: Look at the **Network** tab in Chrome DevTools when clicking *"Fit T-Shirts under 30"*. You will see the real fetch request to `fakestoreapi.com`.
2. **Product Details**:
   * **Endpoint**: `GET https://fakestoreapi.com/products/:id`
3. **Cart Operations**:
   * **Endpoint**: None (Client-side Redux store + `localStorage.setItem('cartItems', ...)`).
4. **Checkout Operations**:
   * **Endpoint**: None (React Router client-side navigation to `#/checkout`).

---

## 7. Step-by-Step Lifecycle (From Keystroke to Screen)

```
Step 1: User types "Show me Fit T-Shirts under 30" and clicks Send.
Step 2: AIAssistant.tsx appends user message to messages state:
        { sender: 'user', text: 'Show me Fit T-Shirts under 30' }
Step 3: processAgentRequest() runs:
        - Detects search intent
        - Extracts query: "Fit T-Shirts"
        - Extracts maxPrice: 30
Step 4: AIAssistant invokes WebMCP:
        webMCPRegistry.executeTool("search_products", { query: "Fit T-Shirts", maxPrice: 30 })
Step 5: WebMCP delegates to productTools.ts, which calls productService.getProducts().
Step 6: fetch('https://fakestoreapi.com/products') executes across the network.
Step 7: FakeStore API responds with catalog JSON.
Step 8: productTools.ts filters products:
        - "Mens Casual Premium Slim Fit T-Shirts" (title matches!)
        - Price 22.30 <= 30 (matches!)
Step 9: WebMCP returns structured JSON:
        {
          "query": "Fit T-Shirts",
          "totalMatches": 1,
          "products": [{ "id": 2, "title": "Mens Casual Premium Slim Fit T-Shirts", "price": 22.3, ... }]
        }
Step 10: AIAssistant receives the JSON and updates state:
         - Displays tool trace: ⚡ WebMCP Tool: search_products
         - Renders product card with title, image, price (Rs.22.30), and an "Add" button.
Step 11: User clicks the "Add" button on the card.
Step 12: AIAssistant executes:
         webMCPRegistry.executeTool("add_to_cart", { productId: 2, quantity: 1, confirmed: true })
Step 13: WebMCP dispatches to Redux:
         dispatch(addToCart({ id: 2, title: "Mens Casual Premium Slim Fit T-Shirts", price: 22.3, ... }))
Step 14: Redux updates state.cart.items and writes to localStorage['cartItems'].
Step 15: React re-renders active UI components:
         - Header badge turns red and updates to "1".
         - react-toastify displays: "1 × Mens Casual Premium Slim Fit T-Shirts added to cart".
         - Cart drawer displays the item at Rs.22.30.
```

---

## 8. Security & Safety Guarantees

* **No Automatic Payments**: `start_checkout` **never charges a card**. It prepares the order summary and navigates the user to the `/checkout` page so payment details are entered manually by the human customer.
* **Tamper-Proof Pricing**: In `add_to_cart`, the price is fetched directly from the authentic catalog service before adding to the cart, preventing an AI agent or attacker from injecting custom low prices.
* **Confirmation Requirement**: Critical mutating actions require explicit confirmation (`confirmed: true`) to avoid accidental purchases.
* **Truthful Capability Reporting**: Because FakeStore API lacks coupon verification, `apply_coupon` returns `{ status: "UNAVAILABLE" }` rather than generating false client discounts.

---

## 9. How to Demonstrate to Stakeholders

1. **Open the Application**: Navigate to `http://localhost:5173/Ecommerce/`.
2. **Open the Assistant**: Click the glowing button at the bottom-right corner:  
   `🤖 AI Assistant (WebMCP)`.
3. **Execute Search**: Click the quick prompt: *"Fit T-Shirts under 30"*.  
   *Point out*: The badge `⚡ WebMCP Tool: search_products` appears, and the product card with Rs.22.30 is rendered.
4. **Execute Add to Cart**: Click **"Add"** on the product card inside the chat.  
   *Point out*: The header cart badge changes to `1` and a toast alert pops up instantly.
5. **Inspect in DevTools**: Open `F12` $\rightarrow$ **Application** tab $\rightarrow$ click **WebMCP**. Show that Chrome DevTools detects all 8 registered tools live under **Available WebMCP Tools**.

