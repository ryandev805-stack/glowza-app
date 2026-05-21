import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Bell,
  Boxes,
  ChartNoAxesCombined,
  Flag,
  FolderTree,
  LogOut,
  Menu,
  PackagePlus,
  PackageSearch,
  ScanSearch,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
} from 'lucide-react';
import { isAdminLoggedIn, loginAdmin, logoutAdmin } from './auth';
import { BannersPage } from './pages/BannersPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductEditorPage, ProductsPage } from './pages/ProductsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { UsersPage } from './pages/UsersPage';
import { WinningProductsPage } from './pages/WinningProductsPage';

type RouteId =
  | 'dashboard'
  | 'products'
  | 'winning-products'
  | 'product-new'
  | 'product-edit'
  | 'categories'
  | 'banners'
  | 'orders'
  | 'order-detail'
  | 'reviews'
  | 'notifications'
  | 'users';

type AppRoute = {
  id: RouteId;
  title: string;
  path: string;
  section: string;
  productId?: string;
  orderId?: string;
};

const navItems: Array<{
  id: AppRoute['section'];
  label: string;
  path: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: ChartNoAxesCombined },
  { id: 'products', label: 'Products', path: '/products', icon: PackageSearch },
  { id: 'winning-products', label: 'Winning', path: '/winning-products', icon: ScanSearch },
  { id: 'categories', label: 'Categories', path: '/categories', icon: FolderTree },
  { id: 'banners', label: 'Banners', path: '/banners', icon: Flag },
  { id: 'orders', label: 'Orders', path: '/orders', icon: ShoppingBag },
  { id: 'reviews', label: 'Reviews', path: '/reviews', icon: Star },
  { id: 'notifications', label: 'Notify', path: '/notifications', icon: Bell },
  { id: 'users', label: 'Users', path: '/users', icon: Users },
] as const;

function parseRoute(pathname: string): AppRoute {
  const path = pathname === '/' ? '/dashboard' : pathname;
  const productEdit = path.match(/^\/products\/([^/]+)\/edit$/);
  const orderDetail = path.match(/^\/orders\/([^/]+)$/);

  if (path === '/products/new') {
    return { id: 'product-new', title: 'New Product', path, section: 'products' };
  }
  if (productEdit) {
    return {
      id: 'product-edit',
      title: 'Edit Product',
      path,
      section: 'products',
      productId: decodeURIComponent(productEdit[1]),
    };
  }
  if (orderDetail) {
    return {
      id: 'order-detail',
      title: 'Order Detail',
      path,
      section: 'orders',
      orderId: decodeURIComponent(orderDetail[1]),
    };
  }
  if (path === '/products') return { id: 'products', title: 'Products', path, section: 'products' };
  if (path === '/winning-products') return { id: 'winning-products', title: 'Winning Products', path, section: 'winning-products' };
  if (path === '/categories') return { id: 'categories', title: 'Categories', path, section: 'categories' };
  if (path === '/banners') return { id: 'banners', title: 'Banners', path, section: 'banners' };
  if (path === '/orders') return { id: 'orders', title: 'Orders', path, section: 'orders' };
  if (path === '/reviews') return { id: 'reviews', title: 'Reviews', path, section: 'reviews' };
  if (path === '/notifications') return { id: 'notifications', title: 'Notifications', path, section: 'notifications' };
  if (path === '/users') return { id: 'users', title: 'Users', path, section: 'users' };
  return { id: 'dashboard', title: 'Dashboard', path: '/dashboard', section: 'dashboard' };
}

function useAdminRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setRoute(parseRoute(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { route, navigate };
}

export function App() {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { route, navigate } = useAdminRoute();

  useEffect(() => {
    if (loggedIn && window.location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return <LoginPage onLogin={() => { setLoggedIn(true); navigate('/dashboard'); }} />;
  }

  const goTo = (path: string) => {
    navigate(path);
    setMobileSidebarOpen(false);
  };

  return (
    <div className={`admin-shell ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
      <button
        className="sidebar-scrim"
        aria-label="Close menu"
        onClick={() => setMobileSidebarOpen(false)}
      />
      <aside className="admin-sidebar">
        <BrandBlock subtitle="Admin Console" />
        <nav className="admin-nav" aria-label="Admin sections">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={route.section === item.id ? 'active' : ''}
              onClick={() => goTo(item.path)}
            >
              <span className="nav-icon"><item.icon size={18} /></span>
              {item.label}
            </button>
          ))}
        </nav>
        <button
          className="ghost logout"
          onClick={() => {
            logoutAdmin();
            setLoggedIn(false);
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="mobile-menu-button" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <BrandBlock subtitle={route.title} />
          <div className="topbar-actions">
            <button className="ghost" onClick={() => goTo('/products/new')}><PackagePlus size={17} /> New Product</button>
            <button
              className="ghost"
              onClick={() => {
                logoutAdmin();
                setLoggedIn(false);
              }}
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </header>

        <main className="admin-content">
          <RouteView route={route} navigate={navigate} />
        </main>
      </div>
    </div>
  );
}

function RouteView({
  route,
  navigate,
}: {
  route: AppRoute;
  navigate: (path: string) => void;
}) {
  const actions = useMemo(
    () => ({
      dashboard: () => navigate('/dashboard'),
      products: () => navigate('/products'),
      newProduct: () => navigate('/products/new'),
      editProduct: (id: string) => navigate(`/products/${encodeURIComponent(id)}/edit`),
      winningProducts: () => navigate('/winning-products'),
      categories: () => navigate('/categories'),
      banners: () => navigate('/banners'),
      orders: () => navigate('/orders'),
      orderDetail: (id: string) => navigate(`/orders/${encodeURIComponent(id)}`),
      reviews: () => navigate('/reviews'),
      notifications: () => navigate('/notifications'),
      users: () => navigate('/users'),
    }),
    [navigate],
  );

  switch (route.id) {
    case 'products':
      return <ProductsPage onCreate={actions.newProduct} onEdit={actions.editProduct} />;
    case 'winning-products':
      return <WinningProductsPage onEdit={actions.editProduct} />;
    case 'product-new':
      return <ProductEditorPage onDone={actions.products} />;
    case 'product-edit':
      return <ProductEditorPage productId={route.productId} onDone={actions.products} />;
    case 'categories':
      return <CategoriesPage />;
    case 'banners':
      return <BannersPage />;
    case 'orders':
      return <OrdersPage onView={actions.orderDetail} onBack={actions.orders} />;
    case 'order-detail':
      return <OrdersPage orderId={route.orderId} onView={actions.orderDetail} onBack={actions.orders} />;
    case 'reviews':
      return <ReviewsPage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'users':
      return <UsersPage />;
    default:
      return <DashboardPage onNavigate={navigate} />;
  }
}

function BrandBlock({ subtitle }: { subtitle: string }) {
  return (
    <div className="brand">
      <img className="brand-mark" src="/app-icon-dot.png" alt="Glowza" />
      <div>
        <strong>Glowza</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <main className="login">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (loginAdmin(email, password)) {
            onLogin();
          } else {
            setError('Invalid admin login');
          }
        }}
      >
        <div className="login-badge"><ShieldCheck size={22} /></div>
        <BrandBlock subtitle="Private management console" />
        <div>
          <span className="eyebrow">Secure Console</span>
          <h1>Manage Glowza operations</h1>
          <p>Products, banners, orders, users, reviews, and notifications in one Firebase-backed workspace.</p>
        </div>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit"><Boxes size={18} /> Login to Admin</button>
      </form>
    </main>
  );
}
