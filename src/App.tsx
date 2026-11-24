import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { BottomNav } from './components/BottomNav';
import { CheckoutModal } from './components/CheckoutModal';
import { ToastContainer, FloatingWhatsApp } from './components/ToastContainer';

import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CustomCorporatePage } from './pages/CustomCorporatePage';
import { AboutPage } from './pages/AboutPage';
import { HowToOrderFaqPage } from './pages/HowToOrderFaqPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import PesananSayaPage from './pages/PesananSayaPage';
import { LegalPage } from './pages/LegalPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useDocumentMeta } from './lib/documentMeta';
import { trackPageView } from './lib/tracker';

const ScrollToTopOnNavigate: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    // Trafik dicatat per navigasi. Halaman /admin & /produk/:slug punya
    // pencatat sendiri agar tidak terhitung dua kali.
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/produk/')) {
      trackPageView(pathname);
    }
  }, [pathname]);
  return null;
};

/** Judul tab & meta description mengikuti URL (crawler ditangani middleware). */
const DocumentMeta: React.FC = () => {
  const { pathname } = useLocation();
  useDocumentMeta(pathname);
  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollToTopOnNavigate />
        <DocumentMeta />
        {/*
          Padding bawah di HP memberi ruang untuk bilah navigasi bawah
          (52px + safe-area). Tanpa ini, baris terakhir halaman tertutup
          bilah tersebut. Di desktop padding dimatikan (lg:pb-0).
        */}
        <div className="min-h-screen flex flex-col bg-surface pb-[calc(52px+env(safe-area-inset-bottom,0px))] lg:pb-0">
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
              <Route path="/pesanan-saya" element={<PesananSayaPage />} />
              <Route path="/legalitas" element={<LegalPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              {/* 404 sungguhan — jangan arahkan ke beranda agar Google tidak
                  mengindeks halaman duplikat untuk setiap URL salah. */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
          <BottomNav />
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
