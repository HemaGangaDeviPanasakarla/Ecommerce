import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import { Provider } from 'react-redux';
import { store } from './store';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Home from './components/Home/Home';
import Product from './components/Product/Product';
import Cart from './components/Cart/Cart';
import Checkout from './components/Checkout/Checkout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  return (
    <Provider store={store}>
      <Router basename="/Ecommerce">
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow">
            <Routes>
             
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/products" element={<Product />} />
              <Route path="/checkout" element={<Checkout />} />


              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <Footer />
          <Cart />
          <ToastContainer position="top-center" autoClose={3000} />
        </div>
      </Router>
    </Provider>
  );
}
