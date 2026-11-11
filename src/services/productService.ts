import type { Product } from '../features/products/types';

const API_BASE_URL = 'https://fakestoreapi.com';

export const productService = {
  /**
   * Fetch all products from the external FakeStore API.
   */
  async getProducts(): Promise<Product[]> {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map((product: any) => ({
      id: Number(product.id),
      title: String(product.title),
      price: Number(product.price),
      image: String(product.image),
      category: String(product.category),
      rating: Number(product.rating?.rate || 0),
    }));
  },

  /**
   * Fetch a single product by its ID from the external FakeStore API.
   */
  async getProductById(id: number): Promise<(Product & { description?: string }) | null> {
    if (!id || isNaN(id)) {
      throw new Error('Valid numeric product ID is required');
    }
    const response = await fetch(`${API_BASE_URL}/products/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch product ${id}: ${response.statusText}`);
    }
    const product = await response.json();
    if (!product || !product.id) return null;

    return {
      id: Number(product.id),
      title: String(product.title),
      price: Number(product.price),
      image: String(product.image),
      category: String(product.category),
      rating: Number(product.rating?.rate || 0),
      description: product.description ? String(product.description) : undefined,
    };
  },

  /**
   * Fetch all distinct categories from FakeStore API.
   */
  async getCategories(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/products/categories`);
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }
    return await response.json();
  },
};

