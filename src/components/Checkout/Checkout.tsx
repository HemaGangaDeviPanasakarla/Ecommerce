import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../hooks';
import {
  resetCheckout,
  setCheckoutForm,
  submitCheckout,
  type CheckoutForm,
} from '../../features/checkout/checkoutSlice';
import { toast } from 'react-toastify';

export default function Checkout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: cartItems } = useAppSelector((state) => state.cart);
  const {
    form: formData,
    errors,
    isSubmitting,
    orderConfirmed,
    finalTotal,
  } = useAppSelector((state) => state.checkout);

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    dispatch(setCheckoutForm({ [name]: value } as Partial<CheckoutForm>));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(submitCheckout()).unwrap();
      toast.success("Order placed successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Please fill all required fields correctly");
    }
  };

  if (cartItems.length === 0 && !orderConfirmed) {
    toast.error("Your cart is empty");
    navigate('/products');
    return null;
  }

  if (orderConfirmed) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto bg-blue-50 p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-center mb-6 text-blue-800">Order Confirmed!</h2>
          <div className="space-y-3">
            <p><strong>Name:</strong> {formData.name}</p>
            <p><strong>Email:</strong> {formData.email}</p>
            <p><strong>Address:</strong> {formData.address}</p>
            <p><strong>Payment Method:</strong> {formData.paymentOption}</p>
            <p><strong>Total Amount:</strong> Rs.{finalTotal.toFixed(2)}</p>
          </div>
          <button
            onClick={() => {
              dispatch(resetCheckout());
              navigate('/home');
            }}
            className="mt-6 w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 pb-2 border-b">Order Summary</h2>
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center border-b pb-4">
                <img src={item.image} alt={item.title} className="w-16 h-16 object-contain mr-4" />
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p>Rs.{item.price} × {item.quantity} = Rs.{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t text-right">
            <p className="font-bold text-lg">Total: Rs.{total.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold mb-6">Checkout</h1>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            {...{
              'tool-name': 'submit_checkout_form',
              'tool-description': 'Submit customer shipping details and payment method to complete the checkout order.',
            }}
          >
            <div>
              <label htmlFor="name" className="block mb-1 font-medium">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter your full name"
                {...{ 'tool-prop-description': 'Full legal name of the recipient' }}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block mb-1 font-medium">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter your email"
                {...{ 'tool-prop-description': 'Email address for order receipts and confirmation' }}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="address" className="block mb-1 font-medium">Address</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className={`w-full p-3 border rounded ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter your complete address"
                {...{ 'tool-prop-description': 'Complete physical delivery address' }}
              />
              {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
            </div>

            <div>
              <label htmlFor="paymentOption" className="block mb-1 font-medium">Payment Method</label>
              <select
                id="paymentOption"
                name="paymentOption"
                value={formData.paymentOption}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded ${errors.paymentOption ? 'border-red-500' : 'border-gray-300'}`}
                {...{ 'tool-prop-description': 'Selected payment method (Phone Pay, Gpay, Cash on Delivery)' }}
              >
                <option value="select any option">Select payment method</option>
                <option value="Phone Pay">Phone Pay</option>
                <option value="Gpay">Gpay</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
              </select>
              {errors.paymentOption && <p className="text-red-500 text-sm mt-1">{errors.paymentOption}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="flex-1 py-2 border border-gray-800 rounded hover:bg-gray-100 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : `Pay Rs.${total.toFixed(2)}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
