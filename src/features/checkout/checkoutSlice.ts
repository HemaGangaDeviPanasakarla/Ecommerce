import { createSlice, createAsyncThunk, createAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../../store';
import { clearCart } from '../cart/cartSlice';

export const CHECKOUT_PAYMENT_OPTIONS = ['Phone Pay', 'Gpay', 'Cash on Delivery'] as const;

export interface CheckoutForm {
  name: string;
  email: string;
  address: string;
  paymentOption: string;
}

export const initialCheckoutForm: CheckoutForm = {
  name: '',
  email: '',
  address: '',
  paymentOption: 'select any option',
};

interface CheckoutState {
  form: CheckoutForm;
  errors: Record<string, string>;
  isSubmitting: boolean;
  orderConfirmed: boolean;
  finalTotal: number;
}

const initialState: CheckoutState = {
  form: initialCheckoutForm,
  errors: {},
  isSubmitting: false,
  orderConfirmed: false,
  finalTotal: 0,
};

export const setCheckoutForm = createAction<Partial<CheckoutForm>>('checkout/setCheckoutForm');
export const setCheckoutErrors = createAction<Record<string, string>>('checkout/setCheckoutErrors');
export const setCheckoutSubmitting = createAction<boolean>('checkout/setCheckoutSubmitting');
export const completeCheckout = createAction<number>('checkout/completeCheckout');
export const resetCheckout = createAction('checkout/resetCheckout');

export function normalizePaymentOption(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  const match = CHECKOUT_PAYMENT_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return match || null;
}

export function validateCheckoutField(field: keyof CheckoutForm, value: string): string {
  switch (field) {
    case 'name':
      return value.trim() ? '' : 'Name is required';
    case 'email':
      if (!value.trim()) return 'Email is required';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Please enter a valid email';
    case 'address':
      return value.trim() ? '' : 'Address is required';
    case 'paymentOption': {
      if (!value.trim() || value === 'select any option') return 'Please select a payment method';
      return normalizePaymentOption(value) ? '' : `Please choose one of: ${CHECKOUT_PAYMENT_OPTIONS.join(', ')}`;
    }
    default:
      return '';
  }
}

export function validateCheckoutForm(form: CheckoutForm): Record<string, string> {
  const errors: Record<string, string> = {};
  (Object.keys(form) as Array<keyof CheckoutForm>).forEach((field) => {
    const error = validateCheckoutField(field, form[field]);
    if (error) errors[field] = error;
  });
  return errors;
}

export const submitCheckout = createAsyncThunk<
  { finalTotal: number },
  void,
  {
    state: RootState;
    dispatch: AppDispatch;
    rejectValue: { message: string; errors: Record<string, string> };
  }
>(
  'checkout/submitCheckout',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const { checkout, cart } = getState();

    const errors = validateCheckoutForm(checkout.form);
    if (Object.keys(errors).length > 0) {
      dispatch(setCheckoutErrors(errors));
      return rejectWithValue({ message: 'Please fill all required fields correctly.', errors });
    }

    if (cart.items.length === 0) {
      return rejectWithValue({ message: 'Your cart is empty.', errors: {} });
    }

    dispatch(setCheckoutSubmitting(true));
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const total = getState().cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const finalTotal = Number(total.toFixed(2));

    dispatch(completeCheckout(finalTotal));
    dispatch(clearCart());

    return { finalTotal };
  }
);

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setCheckoutForm, (state, action) => {
        state.form = { ...state.form, ...action.payload };
        Object.keys(action.payload).forEach((field) => {
          if (state.errors[field]) state.errors[field] = '';
        });
      })
      .addCase(setCheckoutErrors, (state, action) => {
        state.errors = action.payload;
      })
      .addCase(setCheckoutSubmitting, (state, action) => {
        state.isSubmitting = action.payload;
      })
      .addCase(completeCheckout, (state, action) => {
        state.orderConfirmed = true;
        state.finalTotal = action.payload;
      })
      .addCase(resetCheckout, (state) => {
        state.form = initialCheckoutForm;
        state.errors = {};
        state.isSubmitting = false;
        state.orderConfirmed = false;
        state.finalTotal = 0;
      })
      .addCase(submitCheckout.pending, (state) => {
        state.isSubmitting = true;
      })
      .addCase(submitCheckout.fulfilled, (state) => {
        state.isSubmitting = false;
      })
      .addCase(submitCheckout.rejected, (state) => {
        state.isSubmitting = false;
      });
  },
});

export default checkoutSlice.reducer;
