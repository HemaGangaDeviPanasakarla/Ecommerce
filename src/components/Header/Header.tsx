import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShoppingCart } from "@fortawesome/free-solid-svg-icons";
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { toggleCart } from '../../features/cart/cartSlice';
import { useState } from "react";

export default function Header() {
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((state) => state.cart.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 bg-gray-300 text-white p-4 flex justify-between items-center shadow-md z-50">
      <div className="text-xl font-bold">
        <Link to="/home" className="text-gray-800 hover:text-gray-600">
          Our Styles
        </Link>
      </div>

      <div className="md:hidden cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
        <span>☰</span>
      </div>

      <div className={`${menuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row absolute md:static top-16 left-0 right-0 bg-gray-100 md:bg-transparent p-4 md:p-0 gap-4 md:gap-8`}>
        <Link to="/home" className="text-gray-800 hover:text-gray-600">
          Home
        </Link>
        <Link to="/products" className="text-gray-800 hover:text-gray-600">
          Products
        </Link>
        <div 
          className="relative text-gray-800 hover:text-gray-600 cursor-pointer"
          onClick={() => dispatch(toggleCart())}
        >
          <FontAwesomeIcon icon={faShoppingCart} size="lg" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {cartCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}