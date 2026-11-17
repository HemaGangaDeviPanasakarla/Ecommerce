import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Product } from './types';
import { productService } from '../../services/productService';

export interface ProductFilters {
  search: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
}

export const initialProductFilters: ProductFilters = {
  search: '',
  category: 'All',
  minPrice: null,
  maxPrice: null,
  minRating: null,
};

interface ProductsState {
  items: Product[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  filters: ProductFilters;
}

const initialState: ProductsState = {
  items: [],
  status: 'idle',
  filters: initialProductFilters,
};

export const fetchProducts = createAsyncThunk('products/fetchProducts', async () => {
  return await productService.getProducts();
});

function normalizeCategory(value: string): string {
  return value.toLowerCase().replace(/['’]/g, '').trim();
}

export function applyProductFilters(products: Product[], filters: ProductFilters): Product[] {
  const search = filters.search.trim().toLowerCase();
  const category = filters.category && filters.category !== 'All' ? normalizeCategory(filters.category) : '';

  return products.filter((product) => {
    const matchesSearch = !search || product.title.toLowerCase().includes(search);
    const matchesCategory = !category || normalizeCategory(product.category) === category;
    const matchesMinPrice = filters.minPrice === null || product.price >= filters.minPrice;
    const matchesMaxPrice = filters.maxPrice === null || product.price <= filters.maxPrice;
    const matchesMinRating = filters.minRating === null || product.rating >= filters.minRating;

    return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice && matchesMinRating;
  });
}

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setProductFilters: (state, action: PayloadAction<Partial<ProductFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetProductFilters: (state) => {
      state.filters = initialProductFilters;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state) => {
        state.status = 'failed';
      });
  },
});

export const { setProductFilters, resetProductFilters } = productsSlice.actions;

export default productsSlice.reducer;
