/**
 * Checkout & Promotion WebMCP Tools
 * Respects security guidelines: never executes automatic payments,
 * requires explicit user interaction on checkout, and handles coupon API unavailability.
 */

import type { WebMCPTool } from '../types';
import type { RootState } from '../../store';
import type { NavigateFunction } from 'react-router-dom';

interface CheckoutToolsContext {
  getState: () => RootState;
  navigate?: NavigateFunction;
}

export function createCheckoutTools(context: CheckoutToolsContext): WebMCPTool[] {
  const { getState, navigate } = context;

  const applyCouponTool: WebMCPTool = {
    name: 'apply_coupon',
    description: 'Attempt to apply a promotional discount coupon code to the current cart. (Reports API capability status accurately).',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The coupon or promo code to apply.',
        },
      },
      required: ['code'],
    },
    execute: async (input: { code?: string }) => {
      const code = (input?.code || '').trim().toUpperCase();

      if (!code) {
        return {
          error: true,
          message: 'Parameter "code" is required.',
        };
      }

      // In accordance with Phase 3, Item 8:
      // The external FakeStore API does not have a coupon or discount endpoint.
      // We explicitly document and return this status to avoid fabricating unauthorized discounts.
      return {
        applied: false,
        code,
        status: 'UNAVAILABLE',
        message: `Coupon "${code}" could not be applied. The external store API does not support coupon or discount redemption endpoints.`,
        availableDiscount: 0,
      };
    },
  };

  const startCheckoutTool: WebMCPTool = {
    name: 'start_checkout',
    description: 'Initiate the checkout workflow safely. Verifies cart items and navigates the customer to the checkout page for review and secure payment entry.',
    consequentialHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm proceeding to the checkout screen.',
          default: false,
        },
      },
    },
    execute: async (input: { confirmed?: boolean }) => {
      const state = getState();
      const cartItems = state.cart.items || [];

      if (cartItems.length === 0) {
        return {
          success: false,
          status: 'CART_EMPTY',
          message: 'Cannot initiate checkout because your shopping cart is empty. Please add products first.',
        };
      }

      const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Require user confirmation before redirecting/initiating checkout
      if (!input?.confirmed) {
        return {
          requiresConfirmation: true,
          action: 'start_checkout',
          itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
          totalAmount: Number(totalAmount.toFixed(2)),
          currency: 'INR',
          message: `Your cart contains ${cartItems.length} items totaling Rs.${totalAmount.toFixed(2)}. Please confirm to proceed to checkout by passing confirmed: true.`,
        };
      }

      // Safe navigation: takes user to checkout view in the live UI
      if (navigate) {
        navigate('/checkout');
      }

      return {
        success: true,
        status: 'CHECKOUT_READY',
        message: 'Checkout screen opened. Please complete your shipping address and select your payment method on screen to finalize your order.',
        orderSummary: {
          items: cartItems.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            subtotal: Number((item.price * item.quantity).toFixed(2)),
          })),
          totalAmount: Number(totalAmount.toFixed(2)),
          currency: 'INR',
          availablePaymentMethods: ['Phone Pay', 'Gpay', 'Cash on Delivery'],
        },
        securityNotice: 'In accordance with security standards, payment details and final confirmation must be completed directly by the customer on the checkout screen.',
      };
    },
  };

  return [applyCouponTool, startCheckoutTool];
}

