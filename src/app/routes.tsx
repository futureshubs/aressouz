import { createBrowserRouter } from 'react-router';
import { Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import AppContent from './AppContent';
import { RouteChunkSkeleton } from './components/skeletons';
import { LocationProvider } from './context/LocationContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { RentalCartProvider } from './context/RentalCartContext';

const SharePlacePage = lazy(() => import('./pages/SharePlacePage').then((m) => ({ default: m.SharePlacePage })));
const OrderReviewSharePage = lazy(() =>
  import('./pages/OrderReviewSharePage').then((m) => ({ default: m.OrderReviewSharePage })),
);
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BranchLogin = lazy(() => import('./pages/BranchLogin'));
const BranchDashboard = lazy(() => import('./pages/BranchDashboard'));
const CourierLogin = lazy(() => import('./pages/CourierLogin'));
const CourierDashboard = lazy(() => import('./pages/CourierDashboard'));
const SellerLogin = lazy(() => import('./pages/SellerLogin'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const PrepareWrapper = lazy(() => import('./pages/PrepareWrapper'));
const RestaurantLogin = lazy(() => import('./pages/RestaurantLogin'));
const RestaurantPanel = lazy(() => import('./pages/RestaurantPanel'));
const BogalterLogin = lazy(() => import('./pages/BogalterLogin'));
const BogalterDashboard = lazy(() => import('./pages/BogalterDashboard'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const Payment = lazy(() => import('./pages/Payment'));
const PaymentDemo = lazy(() => import('./components/PaymentDemo'));
const OrdersPage = lazy(() => import('./pages/Orders'));
const OrderDetailsPage = lazy(() => import('./pages/OrderDetails'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={<RouteChunkSkeleton />}>{node}</Suspense>
);

// Error Boundary Component (exported so App.tsx can wrap RouterProvider)
export class ErrorBoundary extends Component<
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
      <LocationProvider>
        <FavoritesProvider>
          <RentalCartProvider>
            <AppContent />
          </RentalCartProvider>
        </FavoritesProvider>
      </LocationProvider>
    </ErrorBoundary>
  );
}

function AppRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <LocationProvider>
        <FavoritesProvider>
          <RentalCartProvider>{children}</RentalCartProvider>
        </FavoritesProvider>
      </LocationProvider>
    </ErrorBoundary>
  );
}

// Admin Route Component
function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

// Router Configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainAppRoute />,
  },
  {
    path: '/place/:shareCode',
    element: <ErrorBoundary>{withSuspense(<SharePlacePage />)}</ErrorBoundary>,
  },
  {
    path: '/order-review/:token',
    element: <ErrorBoundary>{withSuspense(<OrderReviewSharePage />)}</ErrorBoundary>,
  },
  {
    path: '/admin',
    element: <AdminRoute>{withSuspense(<AdminLogin />)}</AdminRoute>,
  },
  {
    path: '/admin/dashboard',
    element: <AdminRoute>{withSuspense(<AdminDashboard />)}</AdminRoute>,
  },
  {
    path: '/filyal',
    element: <AdminRoute>{withSuspense(<BranchLogin />)}</AdminRoute>,
  },
  {
    path: '/filyal/dashboard',
    element: <AdminRoute>{withSuspense(<BranchDashboard />)}</AdminRoute>,
  },
  {
    path: '/kuryer',
    element: <AdminRoute>{withSuspense(<CourierLogin />)}</AdminRoute>,
  },
  {
    path: '/kuryer/dashboard',
    element: <AdminRoute>{withSuspense(<CourierDashboard />)}</AdminRoute>,
  },
  {
    path: '/tayyorlovchi',
    element: <AdminRoute>{withSuspense(<PrepareWrapper />)}</AdminRoute>,
  },
  {
    path: '/seller',
    element: <AdminRoute>{withSuspense(<SellerLogin />)}</AdminRoute>,
  },
  {
    path: '/seller/dashboard',
    element: <AdminRoute>{withSuspense(<SellerDashboard />)}</AdminRoute>,
  },
  {
    path: '/restaurant',
    element: <AdminRoute>{withSuspense(<RestaurantLogin />)}</AdminRoute>,
  },
  {
    path: '/restaurant/panel',
    element: <AdminRoute>{withSuspense(<RestaurantPanel />)}</AdminRoute>,
  },
  {
    path: '/bogalter',
    element: <AdminRoute>{withSuspense(<BogalterLogin />)}</AdminRoute>,
  },
  {
    path: '/bogalter/dashboard',
    element: <AdminRoute>{withSuspense(<BogalterDashboard />)}</AdminRoute>,
  },
  {
    path: '/xodim',
    element: <AdminRoute>{withSuspense(<StaffLogin />)}</AdminRoute>,
  },
  {
    path: '/xodim/dashboard',
    element: <AdminRoute>{withSuspense(<StaffDashboard />)}</AdminRoute>,
  },
  // Role-specific URLs (requested)
  {
    path: '/omborchi',
    element: <AdminRoute>{withSuspense(<StaffLogin requiredRole="warehouse" />)}</AdminRoute>,
  },
  {
    path: '/omborchi/dashboard',
    element: <AdminRoute>{withSuspense(<StaffDashboard />)}</AdminRoute>,
  },
  {
    path: '/support',
    element: <AdminRoute>{withSuspense(<StaffLogin requiredRole="support" />)}</AdminRoute>,
  },
  {
    path: '/support/dashboard',
    element: <AdminRoute>{withSuspense(<StaffDashboard />)}</AdminRoute>,
  },
  {
    path: '/kassa',
    element: <AdminRoute>{withSuspense(<StaffLogin requiredRole="cashier" />)}</AdminRoute>,
  },
  {
    path: '/kassa/dashboard',
    element: <AdminRoute>{withSuspense(<StaffDashboard />)}</AdminRoute>,
  },
  {
    path: '/taom',
    element: <AdminRoute>{withSuspense(<RestaurantLogin />)}</AdminRoute>,
  },
  {
    path: '/taom/panel',
    element: <AdminRoute>{withSuspense(<RestaurantPanel />)}</AdminRoute>,
  },
  {
    path: '/payment',
    element: <AdminRoute>{withSuspense(<Payment />)}</AdminRoute>,
  },
  {
    path: '/payment/demo',
    element: <AdminRoute>{withSuspense(<PaymentDemo />)}</AdminRoute>,
  },
  {
    path: '/orders',
    element: <AppRoute>{withSuspense(<OrdersPage />)}</AppRoute>,
  },
  {
    path: '/orders/:orderId',
    element: <AppRoute>{withSuspense(<OrderDetailsPage />)}</AppRoute>,
  },
  {
    path: '*',
    element: <AppRoute>{withSuspense(<NotFoundPage />)}</AppRoute>,
  },
]);