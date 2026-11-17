/**
 * Checkout & Promotion WebMCP Tools
 * Respects security guidelines: never executes automatic payments,
 * requires explicit user confirmation before placing an order, and
 * handles coupon API unavailability honestly.
 */

import type { WebMCPTool } from '../types';
import type { AppDispatch, RootState } from '../../store';
import type { NavigateFunction } from 'react-router-dom';
import {
  CHECKOUT_PAYMENT_OPTIONS,
  normalizePaymentOption,
  resetCheckout,
  setCheckoutForm,
  submitCheckout,
  validateCheckoutField,
  validateCheckoutForm,
  type CheckoutForm,
} from '../../features/checkout/checkoutSlice';

interface CheckoutToolsContext {
  dispatch: AppDispatch;
  getState: () => RootState;
  navigate?: NavigateFunction;
}

interface CheckoutFormInput {
  name?: string;
  email?: string;
  address?: string;
  paymentOption?: string;
}

function buildOrderSummary(getState: () => RootState) {
  const cartItems = getState().cart.items || [];
  const totalAmount = Number(
    cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );
  const form = getState().checkout.form;

  return {
    items: cartItems.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      subtotal: Number((item.price * item.quantity).toFixed(2)),
    })),
    totalAmount,
    currency: 'INR',
    customer: {
      name: form.name,
      email: form.email,
      address: form.address,
      paymentOption: form.paymentOption,
    },
  };
}

export function createCheckoutTools(context: CheckoutToolsContext): WebMCPTool[] {
  const { dispatch, getState, navigate } = context;

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
    description: 'Open the store\'s checkout screen safely. Verifies the cart is not empty and navigates the customer to the checkout form.',
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

      const totalAmount = Number(
        cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
      );

      if (input?.confirmed !== true) {
        return {
          requiresConfirmation: true,
          action: 'start_checkout',
          itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
          totalAmount,
          currency: 'INR',
          message: `Your cart contains ${cartItems.length} items totaling Rs.${totalAmount.toFixed(2)}. Please confirm to proceed to checkout by passing confirmed: true.`,
        };
      }

      if (getState().checkout.orderConfirmed) {
        dispatch(resetCheckout());
      }

      if (navigate) {
        navigate('/checkout');
      }

      return {
        success: true,
        status: 'CHECKOUT_READY',
        message: 'Checkout screen opened. You can fill the form with fill_checkout_form and place the order with submit_checkout_form.',
        orderSummary: {
          items: cartItems.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            subtotal: Number((item.price * item.quantity).toFixed(2)),
          })),
          totalAmount,
          currency: 'INR',
          availablePaymentMethods: [...CHECKOUT_PAYMENT_OPTIONS],
        },
      };
    },
  };

  const getCheckoutFormTool: WebMCPTool = {
    name: 'get_checkout_form',
    description:
      'Read the current checkout form values (full name, email, delivery address, payment method), validation errors, and order status. Use this to see what the customer has entered on the checkout screen.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const state = getState();
      const cartItems = state.cart.items || [];
      const totalAmount = Number(
        cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
      );

      return {
        form: state.checkout.form,
        errors: state.checkout.errors,
        isSubmitting: state.checkout.isSubmitting,
        orderConfirmed: state.checkout.orderConfirmed,
        finalTotal: state.checkout.finalTotal,
        cartItemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount,
        currency: 'INR',
        availablePaymentMethods: [...CHECKOUT_PAYMENT_OPTIONS],
      };
    },
  };

  const fillCheckoutFormTool: WebMCPTool = {
    name: 'fill_checkout_form',
    description:
      'Fill the checkout form fields (full name, email, delivery address, payment method) on the store\'s checkout screen. Only provide the fields the customer has given you. This does not place the order.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Customer full name.',
        },
        email: {
          type: 'string',
          description: 'Customer email address.',
        },
        address: {
          type: 'string',
          description: 'Complete delivery address.',
        },
        paymentOption: {
          type: 'string',
          description: 'Payment method: "Phone Pay", "Gpay", or "Cash on Delivery".',
          enum: [...CHECKOUT_PAYMENT_OPTIONS],
        },
      },
    },
    execute: async (input: CheckoutFormInput) => {
      const patch: Partial<CheckoutForm> = {};

      if (typeof input?.name === 'string') patch.name = input.name;
      if (typeof input?.email === 'string') patch.email = input.email;
      if (typeof input?.address === 'string') patch.address = input.address;
      if (typeof input?.paymentOption === 'string') {
        const normalized = normalizePaymentOption(input.paymentOption);
        if (!normalized) {
          return {
            success: false,
            errors: {
              paymentOption: `Please choose one of: ${CHECKOUT_PAYMENT_OPTIONS.join(', ')}`,
            },
          };
        }
        patch.paymentOption = normalized;
      }

      if (Object.keys(patch).length === 0) {
        return {
          success: false,
          message: 'Provide at least one of: name, email, address, paymentOption.',
        };
      }

      const errors: Record<string, string> = {};
      (Object.keys(patch) as Array<keyof CheckoutForm>).forEach((field) => {
        const error = validateCheckoutField(field, patch[field] ?? '');
        if (error) errors[field] = error;
      });

      dispatch(setCheckoutForm(patch));

      const form = getState().checkout.form;

      if (Object.keys(errors).length > 0) {
        return {
          success: false,
          errors,
          form,
          message: 'Some checkout fields are invalid. Please correct them and try again.',
        };
      }

      return {
        success: true,
        form,
        errors: {},
        message: 'Checkout form updated. Call submit_checkout_form to place the order.',
      };
    },
  };

  const submitCheckoutFormTool: WebMCPTool = {
    name: 'submit_checkout_form',
    description:
      'Submit the checkout form to place the order. Requires the customer to confirm the exact order (items, total, name, email, address, payment method). Never ask for or process credit card numbers.',
    consequentialHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Set to true only after the customer explicitly confirms the order.',
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
          message: 'Cannot place an order because your shopping cart is empty.',
        };
      }

      const errors = validateCheckoutForm(state.checkout.form);
      const orderSummary = buildOrderSummary(getState);

      if (Object.keys(errors).length > 0) {
        return {
          success: false,
          status: 'INVALID_FORM',
          errors,
          form: state.checkout.form,
          message:
            'The checkout form is incomplete or invalid. Ask the customer for the missing details, fill them with fill_checkout_form, then submit again.',
        };
      }

      if (input?.confirmed !== true) {
        return {
          requiresConfirmation: true,
          action: 'submit_checkout_form',
          orderSummary,
          message: `Please confirm the order: ${cartItems.length} items totaling Rs.${orderSummary.totalAmount.toFixed(2)} for ${state.checkout.form.name} (${state.checkout.form.email}), delivered to the provided address, paid via ${state.checkout.form.paymentOption}. Call submit_checkout_form with confirmed: true to place it.`,
        };
      }

      if (navigate) {
        navigate('/checkout');
      }

      try {
        const result = await dispatch(submitCheckout()).unwrap();
        return {
          success: true,
          status: 'ORDER_CONFIRMED',
          finalTotal: result.finalTotal,
          orderSummary,
          message: `Order placed successfully! Total Rs.${result.finalTotal.toFixed(2)}. The order confirmation is now shown on the checkout screen.`,
        };
      } catch (err: any) {
        return {
          success: false,
          status: 'CHECKOUT_FAILED',
          errors: err?.errors || {},
          message: err?.message || 'The order could not be placed.',
        };
      }
    },
  };

  return [
    applyCouponTool,
    startCheckoutTool,
    getCheckoutFormTool,
    fillCheckoutFormTool,
    submitCheckoutFormTool,
  ];
}
