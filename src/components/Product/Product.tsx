import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartPlus, faSearch, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "../../hooks";
import { addToCart } from "../../features/cart/cartSlice";
import {
  applyProductFilters,
  fetchProducts,
  resetProductFilters,
  setProductFilters,
} from "../../features/products/productsSlice";
import { toast } from "react-toastify";
import type { Product } from '../../features/products/types';

const categories = [
  { label: 'All Categories', value: 'All' },
  { label: "Men's Clothing", value: "men's clothing" },
  { label: "Women's Clothing", value: "women's clothing" },
  { label: "Jewelry", value: "jewelery" },
  { label: "Electronics", value: "electronics" },
];

const priceOptions: Array<{ label: string; minPrice: number | null; maxPrice: number | null }> = [
  { label: 'All Prices', minPrice: null, maxPrice: null },
  { label: 'Under ₹500', minPrice: null, maxPrice: 500 },
  { label: '₹500 - ₹1000', minPrice: 500, maxPrice: 1000 },
  { label: 'Above ₹1000', minPrice: 1000, maxPrice: null },
];

const ratingOptions: Array<{ label: string; minRating: number | null }> = [
  { label: 'All Ratings', minRating: null },
  { label: '4⭐ & above', minRating: 4 },
  { label: '3⭐ & above', minRating: 3 },
  { label: '2⭐ & above', minRating: 2 },
];

export default function Product() {
  const dispatch = useAppDispatch();
  const { items: products, status, filters } = useAppSelector((state) => state.products);

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      dispatch(fetchProducts());
    }
  }, [dispatch, status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (priceRef.current && !priceRef.current.contains(event.target as Node)) {
        setShowPriceDropdown(false);
      }
      if (ratingRef.current && !ratingRef.current.contains(event.target as Node)) {
        setShowRatingDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = applyProductFilters(products, filters);
  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.category !== 'All' ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.minRating !== null;

  const categoryLabel = categories.find((option) => option.value === filters.category)?.label || filters.category;

  const priceLabel =
    filters.minPrice === null && filters.maxPrice === null
      ? 'All Prices'
      : filters.minPrice !== null && filters.maxPrice !== null
        ? `₹${filters.minPrice} - ₹${filters.maxPrice}`
        : filters.minPrice !== null
          ? `Above ₹${filters.minPrice}`
          : `Under ₹${filters.maxPrice}`;

  const ratingLabel = filters.minRating === null ? 'All Ratings' : `${filters.minRating}⭐ & above`;

  const handleAddToCart = (product: Product) => {
    dispatch(addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: 1
    }));
    toast.success(`${product.title} added to cart`);
  };

  return (
    <div className="container mx-auto px-4 py-20">
      <h2 className="text-3xl font-bold text-center mb-8">Our Styles - Fashion that speaks for you</h2>

      <div className="flex flex-wrap gap-4 mb-8 justify-between">
        <div className="relative flex-1 min-w-[250px]">
          <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            type="search"
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => dispatch(setProductFilters({ search: e.target.value }))}
            autoFocus
            {...{
              'tool-name': 'search_products_input',
              'tool-description': 'Interactive search input to filter displayed products by keyword',
            }}
          />
        </div>

        <div className="relative" ref={categoryRef}>
          <div
            className="flex items-center justify-between px-4 py-3 border rounded-lg cursor-pointer min-w-[180px]"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <span>{categoryLabel}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
          {showCategoryDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
              {categories.map(option => (
                <li
                  key={option.value}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    dispatch(setProductFilters({ category: option.value }));
                    setShowCategoryDropdown(false);
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative" ref={priceRef}>
          <div
            className="flex items-center justify-between px-4 py-3 border rounded-lg cursor-pointer min-w-[180px]"
            onClick={() => setShowPriceDropdown(!showPriceDropdown)}
          >
            <span>{priceLabel}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
          {showPriceDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
              {priceOptions.map(option => (
                <li
                  key={option.label}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    dispatch(setProductFilters({ minPrice: option.minPrice, maxPrice: option.maxPrice }));
                    setShowPriceDropdown(false);
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative" ref={ratingRef}>
          <div
            className="flex items-center justify-between px-4 py-3 border rounded-lg cursor-pointer min-w-[180px]"
            onClick={() => setShowRatingDropdown(!showRatingDropdown)}
          >
            <span>{ratingLabel}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
          {showRatingDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
              {ratingOptions.map(option => (
                <li
                  key={option.label}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    dispatch(setProductFilters({ minRating: option.minRating }));
                    setShowRatingDropdown(false);
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => dispatch(resetProductFilters())}
            className="px-4 py-3 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredProducts.length > 0 ? (

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[420px]"
            >
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-48 object-contain mb-4"
              />
              <h3 className="font-medium text-center mb-2 line-clamp-2">{product.title}</h3>
              <p className="text-center mb-1">Rs.{product.price}</p>
              <p className="text-center text-yellow-500 mb-4">⭐ {product.rating}</p>

              <div className="mt-auto">
                <button
                  onClick={() => handleAddToCart(product)}
                  className="w-full py-2 border border-gray-800 rounded hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faCartPlus} />
                  <span>Add to Cart</span>
                </button>
              </div>
            </div>
          ))}
        </div>

      ) : (
        <div className="text-center py-12">
          <p className="text-xl">Sorry, no results found!</p>
          <p>Please check the spelling or try different filters.</p>
        </div>
      )}
    </div>
  );
}
