import { createBrowserRouter } from 'react-router';
import { Component, ErrorInfo, ReactNode } from 'react';
import AppContent from './AppContent';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { RentalCartProvider } from './context/RentalCartContext';
import { SharePlacePage } from './pages/SharePlacePage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import BranchLogin from './pages/BranchLogin';
import BranchDashboard from './pages/BranchDashboard';
import SellerLogin from './pages/SellerLogin';
import SellerDashboard from './pages/SellerDashboard';
import PrepareWrapper from './pages/PrepareWrapper';
import RestaurantLogin from './pages/RestaurantLogin';
import RestaurantPanel from './pages/RestaurantPanel';
import Payment from './pages/Payment';
import PaymentDemo from './components/PaymentDemo';

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          background: '#000',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️ Xatolik yuz berdi</h1>
          <p style={{ marginBottom: '16px', opacity: 0.7 }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#14b8a6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Qayta yuklash
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App Route Component
function MainAppRoute() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <LocationProvider>
            <FavoritesProvider>
              <RentalCartProvider>
                <AppContent />
              </RentalCartProvider>
            </FavoritesProvider>
          </LocationProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Admin Route Component
function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Router Configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainAppRoute />,
  },
  {
    path: '/place/:shareCode',
    element: (
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider>
            <SharePlacePage />
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    ),
  },
  {
    path: '/admin',
    element: <AdminRoute><AdminLogin /></AdminRoute>,
  },
  {
    path: '/admin/dashboard',
    element: <AdminRoute><AdminDashboard /></AdminRoute>,
  },
  {
    path: '/filyal',
    element: <AdminRoute><BranchLogin /></AdminRoute>,
  },
  {
    path: '/filyal/dashboard',
    element: <AdminRoute><BranchDashboard /></AdminRoute>,
  },
  {
    path: '/tayyorlovchi',
    element: <AdminRoute><PrepareWrapper /></AdminRoute>,
  },
  {
    path: '/seller',
    element: <AdminRoute><SellerLogin /></AdminRoute>,
  },
  {
    path: '/seller/dashboard',
    element: <AdminRoute><SellerDashboard /></AdminRoute>,
  },
  {
    path: '/restaurant',
    element: <AdminRoute><RestaurantLogin /></AdminRoute>,
  },
  {
    path: '/restaurant/panel',
    element: <AdminRoute><RestaurantPanel /></AdminRoute>,
  },
  {
    path: '/taom',
    element: <AdminRoute><RestaurantLogin /></AdminRoute>,
  },
  {
    path: '/taom/panel',
    element: <AdminRoute><RestaurantPanel /></AdminRoute>,
  },
  {
    path: '/payment',
    element: <AdminRoute><Payment /></AdminRoute>,
  },
  {
    path: '/payment/demo',
    element: <AdminRoute><PaymentDemo /></AdminRoute>,
  },
  {
    path: '*',
    element: <MainAppRoute />, // Fallback to main app
  },
]);