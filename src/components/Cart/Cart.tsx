import { FaTimes, FaTrashAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { 
  incrementQuantity, 
  decrementQuantity, 
  removeFromCart, 
  toggleCart,
  clearCart 
} from '../../features/cart/cartSlice';
import { toast } from 'react-toastify';

export default function Cart() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, isOpen } = useAppSelector((state) => state.cart);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = () => {
    dispatch(toggleCart());
    navigate("/checkout");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-lg z-50 transition-transform duration-300 ease-in-out">
      <div className="p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-bold">Your Cart</h2>
        <button 
          onClick={() => dispatch(toggleCart())}
          className="text-gray-500 hover:text-gray-700"
        >
          <FaTimes size={24} />
        </button>
      </div>

      <div className="p-4">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No Product in the Cart</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b">
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="w-16 h-16 object-contain"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    <p>Rs.{item.price} × {item.quantity}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button 
                        onClick={() => dispatch(decrementQuantity(item.id))}
                        disabled={item.quantity <= 1}
                        className="w-6 h-6 flex items-center justify-center border rounded disabled:opacity-50"
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button 
                        onClick={() => dispatch(incrementQuantity(item.id))}
                        className="w-6 h-6 flex items-center justify-center border rounded"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => {
                          dispatch(removeFromCart(item.id));
                          toast.info("Item removed from cart");
                        }}
                        className="ml-auto text-red-500"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-right">
              <p className="font-bold text-lg">Total: Rs.{total.toFixed(2)}</p>
              <button
                onClick={handleCheckout}
                className="mt-4 w-full py-2 px-4 border border-gray-800 rounded hover:bg-gray-100 transition-colors font-medium uppercase"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}