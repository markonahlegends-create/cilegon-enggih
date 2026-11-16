import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { ToastContainer, FloatingWhatsApp } from './components/ToastContainer';

import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CustomCorporatePage } from './pages/CustomCorporatePage';
import { AboutPage } from './pages/AboutPage';
import { HowToOrderFaqPage } from './pages/HowToOrderFaqPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { LegalPage } from './pages/LegalPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const ScrollToTopOnNavigate: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollToTopOnNavigate />
        <div className="min-h-screen flex flex-col bg-surface">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/katalog" element={<CatalogPage />} />
              <Route path="/produk/:slug" element={<ProductDetailPage />} />
              <Route path="/custom-korporat" element={<CustomCorporatePage />} />
              <Route path="/tentang-kami" element={<AboutPage />} />
              <Route path="/cara-order-faq" element={<HowToOrderFaqPage />} />
              <Route path="/lacak-pesanan" element={<TrackOrderPage />} />
              <Route path="/legalitas" element={<LegalPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>
          <Footer />
          <CartDrawer />
          <CheckoutModal />
          <ToastContainer />
          <FloatingWhatsApp />
        </div>
      </StoreProvider>
    </BrowserRouter>
  );
};

export default App;
