import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { AdminLayout } from './components/AdminLayout';
import { Login } from './pages/Login';

// Lazy load all pages except Login (shown on first load)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Brands = lazy(() => import('./pages/Brands'));
const StockManagement = lazy(() => import('./pages/StockManagement'));
const QuickInvoice = lazy(() => import('./pages/QuickInvoice'));
const WholesaleInvoice = lazy(() => import('./pages/WholesaleInvoice'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));
const BarcodePrint = lazy(() => import('./pages/BarcodePrint'));

// Loading component
function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route 
          index 
          element={
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          } 
        />
        <Route 
          path="products" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Products />
            </Suspense>
          } 
        />
        <Route 
          path="categories" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Categories />
            </Suspense>
          } 
        />
        <Route 
          path="brands" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Brands />
            </Suspense>
          } 
        />
        <Route 
          path="stock" 
          element={
            <Suspense fallback={<PageLoader />}>
              <StockManagement />
            </Suspense>
          } 
        />
        <Route 
          path="quick-invoice" 
          element={
            <Suspense fallback={<PageLoader />}>
              <QuickInvoice />
            </Suspense>
          } 
        />
        <Route 
          path="wholesale-invoice" 
          element={
            <Suspense fallback={<PageLoader />}>
              <WholesaleInvoice />
            </Suspense>
          } 
        />
        <Route 
          path="invoices" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Invoices />
            </Suspense>
          } 
        />
        <Route 
          path="customers" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Customers />
            </Suspense>
          } 
        />
        <Route 
          path="suppliers" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Suppliers />
            </Suspense>
          } 
        />
        <Route 
          path="reports" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Reports />
            </Suspense>
          } 
        />
        <Route 
          path="barcode-print" 
          element={
            <Suspense fallback={<PageLoader />}>
              <BarcodePrint />
            </Suspense>
          } 
        />
        <Route 
          path="settings" 
          element={
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          } 
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
