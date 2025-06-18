import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartPlus, faSearch, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "../../hooks";
import { addToCart } from "../../features/cart/cartSlice";
import { fetchProducts } from "../../features/products/productsSlice";
import { toast } from "react-toastify";
import type { Product } from '../../features/products/types';
export default function Product() {
  const dispatch = useAppDispatch();
  const { items: products, status } = useAppSelector((state) => state.products);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priceFilter, setPriceFilter] = useState('All');
  const [ratingFilter, setRatingFilter] = useState('All');
  
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

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

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || product.category.toLowerCase() === category.toLowerCase();
    const matchesPrice = priceFilter === 'All' ||
      (priceFilter === '<500' && product.price < 500) ||
      (priceFilter === '500-1000' && product.price >= 500 && product.price <= 1000) ||
      (priceFilter === '>1000' && product.price > 1000);
    const matchesRating = ratingFilter === 'All' || product.rating >= parseFloat(ratingFilter);

    return matchesSearch && matchesCategory && matchesPrice && matchesRating;
  });

  const handleAddToCart =  (product: Product) => {
    dispatch(addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: 1
    }));
    toast.success(`${product.title} added to cart`);
  };

  const categories = [
    { label: 'All Categories', value: 'All' },
    { label: "Men's Clothing", value: "men's clothing" },
    { label: "Women's Clothing", value: "women's clothing" },
    { label: "Jewelry", value: "jewelery" },
    { label: "Electronics", value: "electronics" },
  ];

  const priceFilters = [
    { label: 'All Prices', value: 'All' },
    { label: 'Under ₹500', value: '<500' },
    { label: '₹500 - ₹1000', value: '500-1000' },
    { label: 'Above ₹1000', value: '>1000' },
  ];

  const ratingFilters = [
    { label: 'All Ratings', value: 'All' },
    { label: '4⭐ & above', value: '4' },
    { label: '3⭐ & above', value: '3' },
    { label: '2⭐ & above', value: '2' },
  ];

  if (status === 'loading') return <div className="text-center py-8">Loading...</div>;
  if (status === 'failed') return <div className="text-center py-8 text-red-500">Failed to load products</div>;

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="relative" ref={categoryRef}>
          <div 
            className="flex items-center justify-between px-4 py-3 border rounded-lg cursor-pointer min-w-[180px]"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <span>{categories.find(c => c.value === category)?.label}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
          {showCategoryDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
              {categories.map(option => (
                <li
                  key={option.value}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setCategory(option.value);
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
            <span>{priceFilters.find(p => p.value === priceFilter)?.label}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
          {showPriceDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
              {priceFilters.map(option => (
                <li
                  key={option.value}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setPriceFilter(option.value);
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
            <span>{ratingFilters.find(r => r.value === ratingFilter)?.label}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
          {showRatingDropdown && (
            <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
              {ratingFilters.map(option => (
                <li
                  key={option.value}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setRatingFilter(option.value);
                    setShowRatingDropdown(false);
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <img 
                src={product.image} 
                alt={product.title} 
                className="w-full h-48 object-contain mb-4"
              />
              <h3 className="font-medium text-center mb-2 line-clamp-2">{product.title}</h3>
              <p className="text-center mb-1">Rs.{product.price}</p>
              <p className="text-center text-yellow-500 mb-4">⭐ {product.rating}</p>
              <button 
                onClick={() => handleAddToCart(product)}
                className="w-full py-2 border border-gray-800 rounded hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faCartPlus} />
                <span>Add to Cart</span>
              </button>
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