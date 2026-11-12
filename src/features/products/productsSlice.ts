import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Product } from './types';
import { productService } from '../../services/productService';

interface ProductsState {
  items: Product[];
}

const initialState: ProductsState = {
  items: [],
};

export const fetchProducts = createAsyncThunk('products/fetchProducts', async () => {
  return await productService.getProducts();
});

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchProducts.fulfilled, (state, action) => {
      state.items = action.payload;
    });
  },
});

export default productsSlice.reducer;
