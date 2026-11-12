/**
 * Product-related WebMCP Tools
 * Reuses existing productService and application catalog logic.
 */

import type { WebMCPTool } from '../types';
import { productService } from '../../services/productService';
import type { Product } from '../../features/products/types';

interface CatalogFilterInput {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

async function filterCatalogProducts(input: CatalogFilterInput): Promise<
  | { error: true; message: string }
  | {
      error: false;
      filtered: Product[];
      query: string;
      category: string;
      minPrice: number | null;
      maxPrice: number | null;
      minRating: number | null;
    }
> {
  const query = (input.query || '').trim();
  const queryWords = query ? query.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const category = input.category && input.category !== 'All' ? input.category.toLowerCase() : null;
  const minPrice = typeof input.minPrice === 'number' ? input.minPrice : null;
  const maxPrice = typeof input.maxPrice === 'number' ? input.maxPrice : null;
  const minRating = typeof input.minRating === 'number' ? input.minRating : null;

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return {
      error: true,
      message: 'Invalid price range: minPrice cannot be greater than maxPrice.',
    };
  }

  const products = await productService.getProducts();
  const filtered = products.filter((p: Product) => {
    const titleLower = p.title.toLowerCase();
    const matchesQuery = !query || titleLower.includes(query.toLowerCase()) || queryWords.every((w) => titleLower.includes(w));
    const matchesCat = !category || p.category.toLowerCase() === category;
    const matchesMinPrice = minPrice === null || p.price >= minPrice;
    const matchesMaxPrice = maxPrice === null || p.price <= maxPrice;
    const matchesRating = minRating === null || p.rating >= minRating;
    return matchesQuery && matchesCat && matchesMinPrice && matchesMaxPrice && matchesRating;
  });

  return {
    error: false,
    filtered,
    query,
    category: category || 'All',
    minPrice,
    maxPrice,
    minRating,
  };
}

export function createProductTools(): WebMCPTool[] {
  const searchProductsTool: WebMCPTool = {
    name: 'search_products',
    description: 'Search products in the store catalog by title keyword and optional category filter.',
    readOnlyHint: true,
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
    execute: async (input: CatalogFilterInput & { limit?: number }) => {
      const query = (input?.query || '').trim();
      if (!query) {
        return {
          error: true,
          message: 'Parameter "query" is required and cannot be empty.',
        };
      }

      const result = await filterCatalogProducts({ ...input, query });
      if (result.error) return result;

      const limit = input.limit && input.limit > 0 ? input.limit : 10;
      const results = result.filtered.slice(0, limit);

      return {
        query: result.query,
        category: result.category,
        priceRange: { minPrice: result.minPrice, maxPrice: result.maxPrice },
        totalMatches: result.filtered.length,
        returnedCount: results.length,
        products: results,
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

  const filterProductsTool: WebMCPTool = {
    name: 'filter_products',
    description: 'Filter catalog products by keyword query, category, price range, and minimum rating.',
    readOnlyHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional keyword to search in product title.',
        },
        category: {
          type: 'string',
          description: 'Category name ("All", "men\'s clothing", "women\'s clothing", "jewelery", "electronics").',
          enum: ['All', "men's clothing", "women's clothing", 'jewelery', 'electronics'],
        },
        minPrice: {
          type: 'number',
          description: 'Minimum price threshold in INR (Rs.).',
          minimum: 0,
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price threshold in INR (Rs.).',
          minimum: 0,
        },
        minRating: {
          type: 'number',
          description: 'Minimum customer star rating (e.g. 2, 3, 4, 4.5).',
          minimum: 0,
          maximum: 5,
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of items to return (default 20).',
          minimum: 1,
          maximum: 50,
        },
      },
    },
    execute: async (input: CatalogFilterInput & { limit?: number }) => {
      const result = await filterCatalogProducts(input || {});
      if (result.error) return result;

      const limit = input?.limit && input.limit > 0 ? input.limit : 20;
      const results = result.filtered.slice(0, limit);

      return {
        totalMatches: result.filtered.length,
        returnedCount: results.length,
        appliedFilters: {
          query: result.query || undefined,
          category: result.category,
          minPrice: result.minPrice,
          maxPrice: result.maxPrice,
          minRating: result.minRating,
        },
        products: results,
      };
    },
  };

  return [searchProductsTool, getProductDetailsTool, filterProductsTool];
}
