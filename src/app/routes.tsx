import { createBrowserRouter, useLocation } from 'react-router';
import { ReactNode, Suspense, lazy } from 'react';
import AppContent from './AppContent';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { RouteChunkSkeleton } from './components/skeletons';
import { LocationProvider } from './context/LocationContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { RentalCartProvider } from './context/RentalCartContext';
/** Router hooklari (useNavigate) — lazy chunkda ikkinchi React nusxasi bo‘lib Invalid hook call berardi; login va kuryer panel sahifalarini asos modul bilan bir xil chunkda yuklaymiz. */
import AdminLogin from './pages/AdminLogin';
import AutoCourierLogin from './pages/AutoCourierLogin';
import BogalterLogin from './pages/BogalterLogin';
import BranchLogin from './pages/BranchLogin';
import CourierLogin from './pages/CourierLogin';
import RentalProviderLogin from './pages/RentalProviderLogin';
import RestaurantLogin from './pages/RestaurantLogin';
import SellerLogin from './pages/SellerLogin';
import StaffLogin from './pages/StaffLogin';
import AutoCourierDashboard from './pages/AutoCourierDashboard';
import CourierDashboard from './pages/CourierDashboard';
import CourierMapPage from './pages/CourierMapPage';

const SharePlacePage = lazy(() => import('./pages/SharePlacePage').then((m) => ({ default: m.SharePlacePage })));
const OrderReviewSharePage = lazy(() =>
  import('./pages/OrderReviewSharePage').then((m) => ({ default: m.OrderReviewSharePage })),
);
const ShareTargetPage = lazy(() => import('./pages/ShareTargetPage'));
const OpenFilePage = lazy(() => import('./pages/OpenFilePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BranchDashboard = lazy(() => import('./pages/BranchDashboard'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const PrepareWrapper = lazy(() => import('./pages/PrepareWrapper'));
const RestaurantPanel = lazy(() => import('./pages/RestaurantPanel'));
const BogalterDashboard = lazy(() => import('./pages/BogalterDashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const RentalProviderDashboard = lazy(() => import('./pages/RentalProviderDashboard'));
const Payment = lazy(() => import('./pages/Payment'));
const PaymentDemo = lazy(() => import('./components/PaymentDemo'));
const OrdersPage = lazy(() => import('./pages/Orders'));
const OrderDetailsPage = lazy(() => import('./pages/OrderDetails'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const MarketingDocPage = lazy(() => import('./pages/MarketingDocPage'));

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={<RouteChunkSkeleton />}>{node}</Suspense>
);

/** App.tsx — RouterProvider atrofida */
export { RouteErrorBoundary as ErrorBoundary };

// Main App Route Component
function MainAppRoute() {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKeys={[location.key]}>
      <LocationProvider>
        <FavoritesProvider>
          <RentalCartProvider>
            <AppContent />
          </RentalCartProvider>
        </FavoritesProvider>
      </LocationProvider>
    </RouteErrorBoundary>
  );
}

function AppRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKeys={[location.key]}>
      <LocationProvider>
        <FavoritesProvider>
          <RentalCartProvider>{children}</RentalCartProvider>
        </FavoritesProvider>
      </LocationProvider>
    </RouteErrorBoundary>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKeys={[location.pathname, location.key, location.search]}>
      {children}
    </RouteErrorBoundary>
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
    element: <RouteErrorBoundary>{withSuspense(<SharePlacePage />)}</RouteErrorBoundary>,
  },
  {
    path: '/order-review/:token',
    element: <RouteErrorBoundary>{withSuspense(<OrderReviewSharePage />)}</RouteErrorBoundary>,
  },
  {
    path: '/share-target',
    element: <AppRoute>{withSuspense(<ShareTargetPage />)}</AppRoute>,
  },
  {
    path: '/open-file',
    element: <AppRoute>{withSuspense(<OpenFilePage />)}</AppRoute>,
  },
  {
    path: '/docs/:slug',
    element: <AppRoute>{withSuspense(<MarketingDocPage />)}</AppRoute>,
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
    path: '/kuryer/xarita',
    element: <AdminRoute>{withSuspense(<CourierMapPage />)}</AdminRoute>,
  },
  {
    path: '/avtokuryer',
    element: <AdminRoute>{withSuspense(<AutoCourierLogin />)}</AdminRoute>,
  },
  {
    path: '/avtokuryer/dashboard',
    element: <AdminRoute>{withSuspense(<AutoCourierDashboard />)}</AdminRoute>,
  },
  {
    path: '/tayyorlovchi',
    element: <AdminRoute>{withSuspense(<PrepareWrapper />)}</AdminRoute>,
  },
  {
    path: '/ijara-panel',
    element: <AdminRoute>{withSuspense(<RentalProviderLogin />)}</AdminRoute>,
  },
  {
    path: '/ijara-panel/dashboard',
    element: <AdminRoute>{withSuspense(<RentalProviderDashboard />)}</AdminRoute>,
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