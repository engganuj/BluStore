import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import CreateProductPage from './pages/CreateProductPage';
import EditProductPage from './pages/EditProductPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import CreateOrderPage from './pages/CreateOrderPage';
import ShippingPage from './pages/ShippingPage';
import PaymentsPage from './pages/PaymentsPage';
import SettingsPage from './pages/SettingsPage';
import ChannelsPage from './pages/ChannelsPage';
import CustomersPage from './pages/CustomersPage';
import CreateCustomerPage from './pages/CreateCustomerPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
// import PagesPage from './pages/PagesPage';
// import DesignPage from './pages/DesignPage';
import DiscountsPage from './pages/DiscountsPage';
import AbandonedCartsPage from './pages/AbandonedCartsPage';
import AnalyticsPage from './pages/AnalyticsPage';

// Bridge Stripe OAuth callback params from the main URL query string
// into the HashRouter so useSearchParams() on PaymentsPage can read them.
const StripeCallbackBridge = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeKeys = ['stripe_success', 'stripe_error', 'stripe_onboarding', 'stripe_refresh'];
    const hasStripeParam = stripeKeys.some(k => params.has(k));
    if (hasStripeParam) {
      const hashParams = new URLSearchParams();
      stripeKeys.forEach(k => { if (params.has(k)) hashParams.set(k, params.get(k)); });
      window.history.replaceState({}, '', window.location.pathname + '?page=blu-store');
      navigate(`/payments?${hashParams.toString()}`, { replace: true });
    }
  }, [navigate]);
  return null;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        {/* Routes */}
        <Layout>
          <StripeCallbackBridge />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<CreateProductPage />} />
            <Route path="/products/:id/edit" element={<EditProductPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<CreateOrderPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            {/* <Route path="/pages" element={<PagesPage />} /> */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/new" element={<CreateCustomerPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/discounts" element={<DiscountsPage />} />
            <Route path="/abandoned-carts" element={<AbandonedCartsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            {/* <Route path="/design" element={<DesignPage />} /> */}
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}

export default App;
