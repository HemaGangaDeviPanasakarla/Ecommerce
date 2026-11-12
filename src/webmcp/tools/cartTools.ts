/**
 * Cart-related WebMCP Tools
 * Interacts directly with the live Redux store and cartSlice.
 */

import type { WebMCPTool } from '../types';
import type { AppDispatch, RootState } from '../../store';
import type { CartItem } from '../../features/cart/types';
import { addToCart, removeFromCart, updateQuantity } from '../../features/cart/cartSlice';
import { productService } from '../../services/productService';
import { toast } from 'react-toastify';

interface CartToolsContext {
  dispatch: AppDispatch;
  getState: () => RootState;
}

function validateProductId(rawId: unknown): { ok: true; productId: number } | { ok: false; error: { error: true; message: string } } {
  const productId = Number(rawId);
  if (!productId || isNaN(productId) || productId <= 0) {
    return {
      ok: false,
      error: { error: true, message: 'A valid positive numeric "productId" is required.' },
    };
  }
  return { ok: true, productId };
}

function computeCartSummary(items: CartItem[]) {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    totalItems,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
}

export function createCartTools(context: CartToolsContext): WebMCPTool[] {
  const { dispatch, getState } = context;

  const getCartTool: WebMCPTool = {
    name: 'get_cart',
    description: 'Retrieve the current shopping cart items, quantities, item price subtotals, and total cart value.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const cartItems = getState().cart.items || [];
      const summary = computeCartSummary(cartItems);

      return {
        itemCount: summary.totalItems,
        uniqueItemCount: cartItems.length,
        totalAmount: summary.totalAmount,
        currency: 'INR',
        items: cartItems.map((item) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          subtotal: Number((item.price * item.quantity).toFixed(2)),
          image: item.image,
        })),
      };
    },
  };

  const addToCartTool: WebMCPTool = {
    name: 'add_to_cart',
    description: 'Add a product to the user\'s shopping cart. Validates product ID, price, and quantity. Asks for confirmation before committing.',
    consequentialHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'integer',
          description: 'The numeric ID of the product to add to cart.',
          minimum: 1,
        },
        quantity: {
          type: 'integer',
          description: 'Quantity to add (default is 1).',
          minimum: 1,
          default: 1,
        },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm adding the product to the shopping cart.',
          default: false,
        },
      },
      required: ['productId'],
    },
    execute: async (input: { productId?: number; quantity?: number; confirmed?: boolean }) => {
      const idCheck = validateProductId(input?.productId);
      if (!idCheck.ok) return idCheck.error;

      const quantity = Number(input?.quantity || 1);
      if (isNaN(quantity) || quantity <= 0) {
        return {
          error: true,
          message: 'Quantity must be a positive integer of at least 1.',
        };
      }

      // Fetch authentic product data from catalog service to prevent client price tampering
      const product = await productService.getProductById(idCheck.productId);
      if (!product) {
        return {
          error: true,
          message: `Product with ID ${idCheck.productId} does not exist in store catalog.`,
        };
      }

      if (!input?.confirmed) {
        return {
          requiresConfirmation: true,
          action: 'add_to_cart',
          product: { id: product.id, title: product.title, price: product.price },
          quantity,
          estimatedSubtotal: Number((product.price * quantity).toFixed(2)),
          message: `Are you sure you want to add ${quantity} × "${product.title}" (Rs.${product.price} each) to your cart? Please invoke add_to_cart with confirmed: true to proceed.`,
        };
      }

      dispatch(
        addToCart({
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.image,
          quantity,
        })
      );

      toast.success(`${quantity} × "${product.title}" added to cart`);

      return {
        success: true,
        message: `Successfully added ${quantity} × "${product.title}" to cart.`,
        addedItem: { id: product.id, title: product.title, price: product.price, quantity },
        cartSummary: computeCartSummary(getState().cart.items),
      };
    },
  };

  const updateCartTool: WebMCPTool = {
    name: 'update_cart',
    description: 'Update the quantity of an item already in the cart, or remove it if quantity is set to 0.',
    consequentialHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'integer',
          description: 'The numeric ID of the product in the cart.',
          minimum: 1,
        },
        quantity: {
          type: 'integer',
          description: 'New quantity for the product. Setting to 0 removes the item.',
          minimum: 0,
        },
      },
      required: ['productId', 'quantity'],
    },
    execute: async (input: { productId?: number; quantity?: number }) => {
      const idCheck = validateProductId(input?.productId);
      if (!idCheck.ok) return idCheck.error;

      const quantity = Number(input?.quantity);
      if (isNaN(quantity) || quantity < 0) {
        return {
          error: true,
          message: 'Quantity must be a non-negative integer (0 or greater).',
        };
      }

      const existing = getState().cart.items.find((item) => item.id === idCheck.productId);
      if (!existing) {
        return {
          error: true,
          message: `Product ID ${idCheck.productId} is not currently in the shopping cart.`,
        };
      }

      if (quantity === 0) {
        dispatch(removeFromCart(idCheck.productId));
        toast.info(`Removed "${existing.title}" from cart`);
      } else {
        dispatch(updateQuantity({ id: idCheck.productId, quantity }));
        toast.info(`Updated "${existing.title}" quantity to ${quantity}`);
      }

      return {
        success: true,
        action: quantity === 0 ? 'removed' : 'updated',
        productId: idCheck.productId,
        newQuantity: quantity,
        cartSummary: computeCartSummary(getState().cart.items),
      };
    },
  };

  const removeFromCartTool: WebMCPTool = {
    name: 'remove_from_cart',
    description: 'Remove a product from the shopping cart by its product ID.',
    consequentialHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'integer',
          description: 'The numeric ID of the product to remove from cart.',
          minimum: 1,
        },
      },
      required: ['productId'],
    },
    execute: async (input: { productId?: number }) => {
      const idCheck = validateProductId(input?.productId);
      if (!idCheck.ok) return idCheck.error;

      const existing = getState().cart.items.find((item) => item.id === idCheck.productId);
      if (!existing) {
        return {
          error: true,
          message: `Product ID ${idCheck.productId} is not currently in the shopping cart.`,
        };
      }

      dispatch(removeFromCart(idCheck.productId));
      toast.info(`"${existing.title}" removed from cart`);

      return {
        success: true,
        removedProduct: { id: existing.id, title: existing.title },
        cartSummary: computeCartSummary(getState().cart.items),
      };
    },
  };

  return [getCartTool, addToCartTool, updateCartTool, removeFromCartTool];
}
