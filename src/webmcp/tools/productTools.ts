/**
 * Product-related WebMCP Tools
 * Applies filters to the live Products page (Redux + navigation) and returns matches.
 */

import type { WebMCPTool } from '../types';
import type { AppDispatch, RootState } from '../../store';
import type { NavigateFunction } from 'react-router-dom';
import { productService } from '../../services/productService';
import type { Product } from '../../features/products/types';
import {
  applyProductFilters,
  fetchProducts,
  setProductFilters,
  type ProductFilters,
} from '../../features/products/productsSlice';

interface CatalogFilterInput {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  limit?: number;
}

interface ProductToolsContext {
  dispatch: AppDispatch;
  getState: () => RootState;
  navigate: NavigateFunction;
}

const KNOWN_CATEGORIES = ["men's clothing", "women's clothing", 'jewelery', 'electronics'];

function normalizeCategory(value?: string): string {
  if (!value || value === 'All') return 'All';
  const normalized = value.toLowerCase().replace(/['’]/g, '');
  const match = KNOWN_CATEGORIES.find(
    (category) => category.toLowerCase().replace(/['’]/g, '') === normalized
  );
  return match || value;
}

function toFilters(input: CatalogFilterInput): ProductFilters {
  return {
    search: (input.query || '').trim(),
    category: normalizeCategory(input.category),
    minPrice: typeof input.minPrice === 'number' ? input.minPrice : null,
    maxPrice: typeof input.maxPrice === 'number' ? input.maxPrice : null,
    minRating: typeof input.minRating === 'number' ? input.minRating : null,
  };
}

function validateFilterInput(input: CatalogFilterInput): { error: true; message: string } | null {
  const minPrice = typeof input.minPrice === 'number' ? input.minPrice : null;
  const maxPrice = typeof input.maxPrice === 'number' ? input.maxPrice : null;
  const minRating = typeof input.minRating === 'number' ? input.minRating : null;

  if (minPrice !== null && minPrice < 0) {
    return { error: true, message: 'minPrice cannot be negative.' };
  }
  if (maxPrice !== null && maxPrice < 0) {
    return { error: true, message: 'maxPrice cannot be negative.' };
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return { error: true, message: 'Invalid price range: minPrice cannot be greater than maxPrice.' };
  }
  if (minRating !== null && (minRating < 0 || minRating > 5)) {
    return { error: true, message: 'minRating must be between 0 and 5.' };
  }
  return null;
}

function buildFilterSchema() {
  return {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description: 'Optional keyword to search in product title.',
      },
      category: {
        type: 'string' as const,
        description: 'Category name ("All", "men\'s clothing", "women\'s clothing", "jewelery", "electronics").',
        enum: ['All', "men's clothing", "women's clothing", 'jewelery', 'electronics'],
      },
      minPrice: {
        type: 'number' as const,
        description: 'Minimum price threshold in INR (Rs.).',
        minimum: 0,
      },
      maxPrice: {
        type: 'number' as const,
        description: 'Maximum price threshold in INR (Rs.). Use for "under/below X" requests.',
        minimum: 0,
      },
      minRating: {
        type: 'number' as const,
        description: 'Minimum customer star rating (e.g. 2, 3, 4, 4.5).',
        minimum: 0,
        maximum: 5,
      },
      limit: {
        type: 'integer' as const,
        description: 'Maximum number of items to return (default 20).',
        minimum: 1,
        maximum: 50,
      },
    },
  };
}

let catalogPromise: Promise<Product[]> | null = null;

export function createProductTools(context: ProductToolsContext): WebMCPTool[] {
  const { dispatch, getState, navigate } = context;

  const loadCatalog = async (): Promise<Product[]> => {
    const cached = getState().products.items;
    if (cached.length > 0) return cached;

    if (!catalogPromise) {
      catalogPromise = dispatch(fetchProducts())
        .unwrap()
        .finally(() => {
          catalogPromise = null;
        });
    }
    return catalogPromise;
  };

  const applyFiltersAndNavigate = async (input: CatalogFilterInput, defaultLimit: number) => {
    const filters = toFilters(input);
    const limit = typeof input.limit === 'number' && input.limit > 0 ? input.limit : defaultLimit;
    const products = await loadCatalog();
    const matched = applyProductFilters(products, filters);

    dispatch(setProductFilters(filters));
    navigate('/products');

    return {
      success: true,
      appliedToPage: true,
      navigatedTo: '/products',
      appliedFilters: {
        query: filters.search || undefined,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
      },
      totalMatches: matched.length,
      returnedCount: Math.min(matched.length, limit),
      products: matched.slice(0, limit),
    };
  };

  const filterProductsTool: WebMCPTool = {
    name: 'filter_products',
    description:
      'Filter the products shown on the store\'s Products page by category, price range, minimum rating, and optional keyword, then navigate the shopper to the filtered results. Use this whenever the shopper asks to filter, refine, or browse products on the website.',
    inputSchema: buildFilterSchema(),
    execute: async (input: CatalogFilterInput) => {
      const validationError = validateFilterInput(input || {});
      if (validationError) return validationError;
      return applyFiltersAndNavigate(input || {}, 20);
    },
  };

  const setProductFiltersTool: WebMCPTool = {
    name: 'set_product_filters',
    description:
      'Apply filters (keyword, category, min/max price, minimum rating) directly to the store\'s Products page and navigate the shopper there. Prefer this or filter_products when the shopper wants to filter products on the website.',
    inputSchema: buildFilterSchema(),
    execute: async (input: CatalogFilterInput) => {
      const validationError = validateFilterInput(input || {});
      if (validationError) return validationError;
      return applyFiltersAndNavigate(input || {}, 20);
    },
  };

  const searchProductsTool: WebMCPTool = {
    name: 'search_products',
    description:
      'Search products by title keyword and apply the search to the Products page so the shopper sees the results. Optionally filter by category and price.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword to match against product titles (case-insensitive).',
        },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. "men\'s clothing", "women\'s clothing", "jewelery", "electronics", or "All").',
          enum: ['All', "men's clothing", "women's clothing", 'jewelery', 'electronics'],
        },
        minPrice: {
          type: 'number',
          description: 'Optional minimum price filter in INR (Rs.).',
          minimum: 0,
        },
        maxPrice: {
          type: 'number',
          description: 'Optional maximum price filter in INR (Rs.).',
          minimum: 0,
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of items to return (default 10).',
          minimum: 1,
          maximum: 50,
        },
      },
      required: ['query'],
    },
    execute: async (input: CatalogFilterInput) => {
      const query = (input?.query || '').trim();
      if (!query) {
        return {
          error: true,
          message: 'Parameter "query" is required and cannot be empty.',
        };
      }

      const validationError = validateFilterInput({ ...input, query });
      if (validationError) return validationError;

      const result = await applyFiltersAndNavigate({ ...input, query }, 10);
      return {
        ...result,
        query,
        priceRange: {
          minPrice: result.appliedFilters.minPrice,
          maxPrice: result.appliedFilters.maxPrice,
        },
      };
    },
  };

  const getProductFiltersTool: WebMCPTool = {
    name: 'get_product_filters',
    description:
      'Read the product filters currently applied to the store\'s Products page (search keyword, category, min/max price, minimum rating) and the number of matching products.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const products = await loadCatalog();
      const filters = getState().products.filters;
      const matched = applyProductFilters(products, filters);

      return {
        filters,
        totalProducts: products.length,
        totalMatches: matched.length,
      };
    },
  };

  const getProductDetailsTool: WebMCPTool = {
    name: 'get_product_details',
    description: 'Retrieve detailed information (title, price, category, rating, image, description) for a specific product by its numeric ID.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'integer',
          description: 'The unique numeric ID of the product.',
          minimum: 1,
        },
      },
      required: ['productId'],
    },
    execute: async (input: { productId?: number }) => {
      const id = Number(input?.productId);
      if (!id || isNaN(id) || id <= 0) {
        return {
          error: true,
          message: 'A valid positive numeric "productId" is required.',
        };
      }

      const product = await productService.getProductById(id);
      if (!product) {
        return {
          found: false,
          productId: id,
          message: `Product with ID ${id} was not found in catalog.`,
        };
      }

      return { found: true, product };
    },
  };

  return [
    filterProductsTool,
    setProductFiltersTool,
    searchProductsTool,
    getProductFiltersTool,
    getProductDetailsTool,
  ];
}
