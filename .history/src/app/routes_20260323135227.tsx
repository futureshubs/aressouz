import { createBrowserRouter } from 'react-router';
import { Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import AppContent from './AppContent';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { RentalCartProvider } from './context/RentalCartContext';

const SharePlacePage = lazy(() => import('./pages/SharePlacePage').then(module => ({ default: module.SharePlacePage })));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BranchLogin = lazy(() => import('./pages/BranchLogin'));
const BranchDashboard = lazy(() => import('./pages/BranchDashboard'));
const SellerLogin = lazy(() => import('./pages/SellerLogin'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const PrepareWrapper = lazy(() => import('./pages/PrepareWrapper'));
const RestaurantLogin = lazy(() => import('./pages/RestaurantLogin'));
const RestaurantPanel = lazy(() => import('./pages/RestaurantPanel'));
const Payment = lazy(() => import('./pages/Payment'));
const PaymentDemo = lazy(() => import('./components/PaymentDemo'));

function RouteLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #020617, #0f172a)',
        color: '#14b8a6',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px',
            borderRadius: '999px',
            border: '4px solid rgba(20, 184, 166, 0.2)',
            borderTopColor: '#14b8a6',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ margin: 0, opacity: 0.9 }}>Yuklanmoqda...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

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
function MainAppRoute({
  initialTab,
  initialProfileOpen,
  initialProfileTab,
}: {
  initialTab?: string;
  initialProfileOpen?: boolean;
  initialProfileTab?: 'orders' | 'favorites' | 'portfolio' | 'ads';
} = {}) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <LocationProvider>
            <FavoritesProvider>
              <RentalCartProvider>
                <LazyPage>
                  <AppContent
                    initialTab={initialTab}
                    initialProfileOpen={initialProfileOpen}
                    initialProfileTab={initialProfileTab}
                  />
                </LazyPage>
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
    path: '/profile',
    element: <MainAppRoute initialProfileOpen={true} initialProfileTab="orders" />,
  },
  {
    path: '/profil',
    element: <MainAppRoute initialProfileOpen={true} initialProfileTab="orders" />,
  },
  {
    path: '/orders',
    element: <MainAppRoute initialProfileOpen={true} initialProfileTab="orders" />,
  },
  {
    path: '/orders/:orderId',
    element: <MainAppRoute initialProfileOpen={true} initialProfileTab="orders" />,
  },
  {
    path: '/place/:shareCode',
    element: (
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider>
            <LazyPage>
              <SharePlacePage />
            </LazyPage>
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    ),
  },
  {
    path: '/admin',
    element: <AdminRoute><LazyPage><AdminLogin /></LazyPage></AdminRoute>,
  },
  {
    path: '/admin/dashboard',
    element: <AdminRoute><LazyPage><AdminDashboard /></LazyPage></AdminRoute>,
  },
  {
    path: '/filyal',
    element: <AdminRoute><LazyPage><BranchLogin /></LazyPage></AdminRoute>,
  },
  {
    path: '/filyal/dashboard',
    element: <AdminRoute><LazyPage><BranchDashboard /></LazyPage></AdminRoute>,
  },
  {
    path: '/tayyorlovchi',
    element: <AdminRoute><LazyPage><PrepareWrapper /></LazyPage></AdminRoute>,
  },
  {
    path: '/seller',
    element: <AdminRoute><LazyPage><SellerLogin /></LazyPage></AdminRoute>,
  },
  {
    path: '/seller/dashboard',
    element: <AdminRoute><LazyPage><SellerDashboard /></LazyPage></AdminRoute>,
  },
  {
    path: '/restaurant',
    element: <AdminRoute><LazyPage><RestaurantLogin /></LazyPage></AdminRoute>,
  },
  {
    path: '/restaurant/panel',
    element: <AdminRoute><LazyPage><RestaurantPanel /></LazyPage></AdminRoute>,
  },
  {
    path: '/taom',
    element: <AdminRoute><LazyPage><RestaurantLogin /></LazyPage></AdminRoute>,
  },
  {
    path: '/taom/panel',
    element: <AdminRoute><LazyPage><RestaurantPanel /></LazyPage></AdminRoute>,
  },
  {
    path: '/payment',
    element: <AdminRoute><LazyPage><Payment /></LazyPage></AdminRoute>,
  },
  {
    path: '/payment/demo',
    element: <AdminRoute><LazyPage><PaymentDemo /></LazyPage></AdminRoute>,
  },
  {
    path: '*',
    element: <MainAppRoute />, // Fallback to main app
  },
]);