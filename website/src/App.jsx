import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  ChevronRight,
  CheckCircle2,
  CircleUserRound,
  Grid3X3,
  Heart,
  Home,
  LogIn,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X,
  ChevronLeft,
  PlayCircle,
} from 'lucide-react';
import { Modal } from './components/Modal';
import { ProductCard } from './components/ProductCard';
import { useGlowzaStore } from './hooks/useGlowzaStore';
import { initials, money } from './utils/format';

const nav = ['Home', 'Shop', 'Categories', 'Profile'];
const mobileNav = ['Home', 'Categories', 'Shop', 'Profile'];
const sectionRoutes = {
  Home: '/',
  Shop: '/shop',
  Categories: '/categories',
  Profile: '/profile',
  Privacy: '/privacy-policy',
};

const richTextTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'UL', 'OL', 'LI', 'A', 'H2', 'H3']);

function sanitizeRichText(html) {
  if (!html || typeof window === 'undefined') return '';
  const template = document.createElement('template');
  template.innerHTML = String(html)
    .replace(/\s*\\+\s*/g, '<br>')
    .replace(/\r?\n/g, '<br>')
    .replace(/(<br>\s*){3,}/g, '<br><br>');
  template.content.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    if (!richTextTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    Array.from(node.attributes).forEach((attribute) => {
      const allowedHref = node.tagName === 'A' && attribute.name === 'href';
      if (!allowedHref) node.removeAttribute(attribute.name);
    });
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) {
        node.removeAttribute('href');
      } else {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noreferrer');
      }
    }
  });
  return template.innerHTML;
}

function sectionFromPath(pathname) {
  if (pathname === '/shop' || pathname.startsWith('/product/')) return 'Shop';
  if (pathname === '/categories') return 'Categories';
  if (pathname === '/profile') return 'Profile';
  if (pathname === '/privacy-policy') return 'Privacy';
  return 'Home';
}

export default function App() {
  const store = useGlowzaStore();
  const [active, setActive] = useState(() => sectionFromPath(window.location.pathname));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('popular');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(null);
  const [authAutoShown, setAuthAutoShown] = useState(false);

  useEffect(() => {
    if (store.user || authAutoShown) return undefined;
    const timer = window.setTimeout(() => {
      closePopups();
      setSelectedProduct(null);
      setAuthOpen(true);
      setAuthAutoShown(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [store.user, authAutoShown]);

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();
    const products = store.products.filter((product) => {
      const matchesText = !text || `${product.name} ${product.categoryName}`.toLowerCase().includes(text);
      const matchesCategory = category === 'all' || product.categoryId === category || product.categoryName === category;
      return matchesText && matchesCategory;
    });
    return [...products].sort((a, b) => {
      if (sort === 'price-low') return Number(a.price || 0) - Number(b.price || 0);
      if (sort === 'price-high') return Number(b.price || 0) - Number(a.price || 0);
      if (sort === 'rated') return Number(b.rating || 0) - Number(a.rating || 0);
      if (sort === 'new') return Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0);
      return Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
    });
  }, [store.products, query, category, sort]);

  const bestSellers = store.products.filter((product) => product.isBestSeller).slice(0, 8);
  const newArrivals = store.products.filter((product) => product.isNew).slice(0, 8);
  const flashSale = store.products.filter((product) => product.isFlashSale).slice(0, 8);

  useEffect(() => {
    const handlePopState = () => {
      setActive(sectionFromPath(window.location.pathname));
      if (!window.location.pathname.startsWith('/product/')) {
        setSelectedProduct(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/product/')) return;
    const productId = decodeURIComponent(window.location.pathname.replace('/product/', ''));
    const product = store.products.find((item) => item.id === productId);
    if (product) {
      setActive('Shop');
      setSelectedProduct(product);
      return;
    }
    if (!store.loading && store.categories.length > 0) {
      void store.loadProductById(productId).then((loadedProduct) => {
        if (loadedProduct) {
          setActive('Shop');
          setSelectedProduct(loadedProduct);
        }
      });
    }
  }, [store.products, store.loading, store.categories.length]);

  function navigate(section, { replace = false } = {}) {
    const path = sectionRoutes[section] || '/';
    setActive(section);
    setSelectedProduct(null);
    if (window.location.pathname !== path) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closePopups() {
    setAuthOpen(false);
    setCartOpen(false);
    setCheckoutOpen(false);
    setOrderDone(null);
  }

  function openLogin() {
    closePopups();
    setSelectedProduct(null);
    setAuthOpen(true);
  }

  function openCart() {
    closePopups();
    setSelectedProduct(null);
    setCartOpen(true);
  }

  function openCheckout() {
    closePopups();
    setSelectedProduct(null);
    setCheckoutOpen(true);
  }

  function completeOrder(order) {
    closePopups();
    setOrderDone(order);
  }

  function openProduct(product, { replace = false } = {}) {
    closePopups();
    setActive('Shop');
    setSelectedProduct(product);
    const path = `/product/${encodeURIComponent(product.id)}`;
    const method = replace ? 'replaceState' : 'pushState';
    if (window.location.pathname !== path) {
      window.history[method]({}, '', path);
    }
  }

  function closeProduct() {
    setSelectedProduct(null);
    if (window.location.pathname.startsWith('/product/')) {
      window.history.pushState({}, '', '/shop');
    }
  }

  function requireLogin(action) {
    if (!store.user) {
      openLogin();
      return;
    }
    action();
  }

  function buyNow(product, quantity = 1) {
    requireLogin(() => {
      store.addToCart(product, quantity);
      closePopups();
      setCheckoutOpen(true);
    });
  }

  return (
    <div className="min-h-screen bg-glowza-mist">
      <Header
        user={store.user}
        cartCount={store.cartCount}
        active={active}
        onNav={navigate}
        onLogin={openLogin}
        onLogout={store.logout}
        onCart={openCart}
      />

      <main className="pb-24 md:pb-0">
        {active === 'Home' && (
          <HomePage
            store={store}
            setActive={navigate}
            setCategory={setCategory}
            onOpenProduct={openProduct}
            onCart={buyNow}
            onWish={(product) => requireLogin(() => store.toggleWishlist(product.id))}
            wished={(product) => store.wishlist.has(product.id)}
            bestSellers={bestSellers}
            newArrivals={newArrivals}
            flashSale={flashSale}
          />
        )}
        {active === 'Shop' && (
          <ShopPage
            store={store}
            products={filteredProducts}
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            sort={sort}
            setSort={setSort}
            onOpenProduct={openProduct}
            onCart={buyNow}
            onWish={(product) => requireLogin(() => store.toggleWishlist(product.id))}
          />
        )}
        {active === 'Categories' && (
          <CategoriesPage store={store} setActive={navigate} setCategory={setCategory} />
        )}
        {active === 'Profile' && (
          <ProfilePage store={store} onLogin={openLogin} onOpenProduct={openProduct} />
        )}
        {active === 'Privacy' && <PrivacyPolicyPage />}
      </main>

      <Footer onPrivacy={() => navigate('Privacy')} />

      {authOpen && <LoginModal store={store} onClose={() => setAuthOpen(false)} />}
      {cartOpen && (
        <CartModal
          store={store}
          onClose={() => setCartOpen(false)}
          onCheckout={() => requireLogin(openCheckout)}
        />
      )}
      {checkoutOpen && (
        <CheckoutModal
          store={store}
          onClose={() => setCheckoutOpen(false)}
          onComplete={(order) => {
            completeOrder(order);
          }}
        />
      )}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          store={store}
          onClose={closeProduct}
          onCart={(product) => store.addToCart(product)}
          onBuyNow={(product, quantity) => requireLogin(() => {
            store.addToCart(product, quantity);
            closeProduct();
            openCheckout();
          })}
          onOpenRelated={(product) => openProduct(product, { replace: true })}
          onLogin={openLogin}
        />
      )}
      {orderDone && (
        <Modal title="Order placed" onClose={() => setOrderDone(null)}>
          <div className="space-y-4 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-50 text-green-600">
              <BadgeCheck size={42} />
            </div>
            <p className="text-lg font-black text-glowza-plum">Your order was placed successfully.</p>
            <p className="rounded-2xl bg-pink-50 p-4 font-bold text-glowza-pink">{orderDone.orderNumber}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Header({ user, cartCount, active, onNav, onLogin, onLogout, onCart }) {
  return (
    <header className="sticky top-0 z-40 border-b border-pink-100 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 lg:px-8">
        <button className="flex items-center gap-3 bg-transparent p-0" onClick={() => onNav('Home')}>
          <img src="/app-icon-dot.png" alt="Glowza" className="h-11 w-11 rounded-2xl object-cover shadow-sm" />
          <div className="hidden text-left sm:block">
            <strong className="block text-xl font-black text-glowza-plum">Glowza</strong>
          </div>
          <div className="text-left sm:hidden">
            <strong className="block text-lg font-black leading-none text-glowza-plum">Glowza</strong>
          </div>
        </button>
        <nav className="hidden flex-1 justify-center gap-2 md:flex">
          {nav.map((item) => (
            <button
              key={item}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold ${active === item ? 'bg-glowza-pink text-white shadow-lg shadow-pink-200' : 'bg-transparent text-glowza-plum hover:bg-pink-50'}`}
              onClick={() => onNav(item)}
            >
              <NavIcon item={item} size={16} />
              {item}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button className="relative inline-flex items-center gap-2 rounded-full bg-white px-3 py-2.5 text-sm font-bold text-glowza-pink shadow-sm ring-1 ring-pink-100 sm:px-4 sm:py-3" onClick={onCart}>
            <ShoppingBag size={18} />
            <span className="hidden sm:inline">Cart</span>
            <span className="sm:hidden">Bag</span>
            {cartCount > 0 && <span className="ml-2 rounded-full bg-glowza-pink px-2 py-1 text-xs text-white">{cartCount}</span>}
          </button>
          {user ? (
            <button className="hidden items-center gap-2 rounded-full bg-glowza-plum px-4 py-3 font-bold text-white sm:inline-flex" onClick={onLogout}>
              <LogOut size={16} />
              {initials(user.name)}
            </button>
          ) : (
            <button className="inline-flex items-center gap-2 rounded-full bg-glowza-pink px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-200 sm:py-3" onClick={onLogin}>
              <LogIn size={16} />
              Login
            </button>
          )}
        </div>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[1.65rem] border border-pink-100 bg-white/95 p-1.5 shadow-glow backdrop-blur md:hidden">
        {mobileNav.map((item) => {
          const selected = active === item;
          return (
            <button
              key={item}
              className={`relative grid place-items-center rounded-[1.2rem] px-2 py-2.5 text-[11px] font-bold transition ${selected ? 'bg-glowza-pink text-white shadow-lg shadow-pink-200' : 'text-slate-500'}`}
              onClick={() => item === 'Cart' ? onCart() : onNav(item)}
            >
              <NavIcon item={item} size={19} />
              <span className="mt-0.5 block">{item === 'Cart' ? 'Bag' : item}</span>
              {item === 'Cart' && cartCount > 0 && (
                <span className="absolute right-3 top-1 rounded-full bg-glowza-pink px-1.5 py-0.5 text-[10px] text-white">{cartCount}</span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function NavIcon({ item, size = 18 }) {
  if (item === 'Home') return <Home size={size} />;
  if (item === 'Shop' || item === 'Cart') return <ShoppingBag size={size} />;
  if (item === 'Categories') return <Grid3X3 size={size} />;
  return <UserRound size={size} />;
}

function HomePage({ store, setActive, setCategory, onOpenProduct, onCart, onWish, wished, bestSellers, newArrivals, flashSale }) {
  const heroBanner = store.banners[0];
  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:gap-8 sm:py-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <div className="relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-glowza-plum via-glowza-pink to-glowza-hot p-5 text-white shadow-glow sm:min-h-[520px] sm:rounded-[2rem] sm:p-7 lg:p-10">
          <div className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
            <Sparkles size={24} />
          </div>
          <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-wide sm:mb-4 sm:px-4 sm:text-xs">
            <Sparkles size={14} />
            Premium beauty in Pakistan
          </span>
          <h1 className="max-w-3xl text-4xl font-black leading-none sm:text-6xl lg:text-7xl">Glow that feels curated.</h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold text-white/80 sm:mt-5 sm:text-lg">Shop skincare, makeup, fragrances, Korean beauty, and grooming essentials with a smooth checkout experience.</p>
          <button className="mt-5 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left font-bold text-glowza-pink shadow-sm sm:hidden" onClick={() => setActive('Shop')}>
            <span className="inline-flex items-center gap-2"><Search size={18} /> Search beauty products</span>
            <ChevronRight size={18} />
          </button>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
            <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-glowza-pink sm:px-6 sm:py-4 sm:text-base" onClick={() => setActive('Shop')}>
              <ShoppingBag size={18} />
              Shop Products
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white sm:px-6 sm:py-4 sm:text-base" onClick={() => setActive('Categories')}>
              <Grid3X3 size={18} />
              Categories
            </button>
          </div>
        </div>
        <button
          className="overflow-hidden rounded-[1.8rem] bg-white p-0 text-left shadow-glow sm:rounded-[2rem]"
          onClick={() => {
            if (heroBanner?.link?.startsWith('/products') || heroBanner?.link?.startsWith('/shop')) setActive('Shop');
            if (heroBanner?.link?.startsWith('/categories')) setActive('Categories');
          }}
        >
          {heroBanner?.image ? (
            <img src={heroBanner.image} alt={heroBanner.title} className="h-auto w-full object-cover sm:h-[520px]" />
          ) : (
            <div className="grid h-[220px] place-items-center bg-gradient-to-br from-pink-100 to-purple-100 p-8 text-center sm:h-[520px] sm:p-10">
              <div>
                <p className="text-sm font-black uppercase text-glowza-pink">Glowza Edit</p>
                <h2 className="mt-3 text-2xl font-black text-glowza-plum sm:text-4xl">New beauty drops are waiting.</h2>
              </div>
            </div>
          )}
        </button>
      </section>
      <CategoryRail store={store} setActive={setActive} setCategory={setCategory} />
      <ProductSection title="Flash Sale" products={flashSale} fallback={store.products.slice(0, 8)} onOpenProduct={onOpenProduct} onCart={onCart} onWish={onWish} wished={wished} />
      <ProductSection title="Best Sellers" products={bestSellers} fallback={store.products.slice(0, 8)} onOpenProduct={onOpenProduct} onCart={onCart} onWish={onWish} wished={wished} />
      <ProductSection title="New Arrivals" products={newArrivals} fallback={store.products.slice(0, 8)} onOpenProduct={onOpenProduct} onCart={onCart} onWish={onWish} wished={wished} />
    </div>
  );
}

function CategoryRail({ store, setActive, setCategory }) {
  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
        <div>
          <p className="text-xs font-black uppercase text-glowza-pink sm:text-sm">Departments</p>
          <h2 className="text-2xl font-black text-glowza-plum sm:text-3xl">Shop by category</h2>
        </div>
        <button className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-glowza-pink shadow-sm sm:px-5 sm:py-3" onClick={() => setActive('Categories')}>
          View all <ChevronRight size={16} />
        </button>
      </div>
      <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-8">
        {store.categories.map((item) => (
          <button
            key={item.id}
            className="w-32 shrink-0 snap-start rounded-[1.35rem] border border-pink-100 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-1 md:w-auto md:p-3"
            onClick={() => { setCategory(item.id); setActive('Shop'); }}
          >
            <div className="aspect-square overflow-hidden rounded-2xl bg-pink-50">
              {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-glowza-pink"><Sparkles size={28} /></div>}
            </div>
            <strong className="mt-2 block line-clamp-1 text-sm text-glowza-plum sm:mt-3">{item.name}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductSection({ title, products, fallback, onOpenProduct, onCart, onWish, wished }) {
  const list = products.length ? products : fallback;
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8">
      <div className="mb-4 flex items-end justify-between sm:mb-5">
        <div>
          <p className="text-xs font-black uppercase text-glowza-pink sm:text-sm">Glowza Picks</p>
          <h2 className="text-2xl font-black text-glowza-plum sm:text-3xl">{title}</h2>
        </div>
      </div>
      <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible lg:grid-cols-4">
        {list.map((product) => (
          <div key={product.id} className="w-[168px] shrink-0 snap-start md:w-auto">
            <ProductCard product={product} wished={wished(product)} onOpen={() => onOpenProduct(product)} onCart={() => onCart(product)} onWish={() => onWish(product)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ShopPage({ store, products, query, setQuery, category, setCategory, sort, setSort, onOpenProduct, onCart, onWish }) {
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !store.hasMoreProducts) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void store.loadMoreProducts();
        }
      },
      { rootMargin: '500px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [store.hasMoreProducts, store.loadingMoreProducts, products.length]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-5 sm:py-8 lg:px-8">
      <div className="mb-5 rounded-[1.6rem] bg-white p-3 shadow-glow sm:mb-6 sm:rounded-[2rem] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-glowza-pink" size={18} />
            <input className="focus-ring w-full rounded-2xl border border-pink-100 py-3.5 pl-11 pr-4 text-sm sm:py-4 sm:text-base" placeholder="Search makeup, skincare..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="focus-ring rounded-2xl border border-pink-100 px-4 py-3.5 text-sm sm:py-4 sm:text-base" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {store.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="focus-ring rounded-2xl border border-pink-100 px-4 py-3.5 text-sm sm:py-4 sm:text-base" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="popular">Popular</option>
            <option value="new">Newest</option>
            <option value="price-low">Price low to high</option>
            <option value="price-high">Price high to low</option>
            <option value="rated">Highest rated</option>
          </select>
        </div>
      </div>
      {store.loading && <p className="rounded-2xl bg-white p-6 font-bold text-glowza-pink">Loading products...</p>}
      {store.error && <p className="rounded-2xl bg-red-50 p-6 font-bold text-red-600">{store.error}</p>}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase text-glowza-pink sm:text-sm">Shop</p>
          <h1 className="text-3xl font-black text-glowza-plum sm:text-4xl">{products.length} products</h1>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} wished={store.wishlist.has(product.id)} onOpen={() => onOpenProduct(product)} onCart={() => onCart(product)} onWish={() => onWish(product)} />
        ))}
      </div>
      {store.hasMoreProducts && (
        <div ref={loadMoreRef} className="mt-8 flex justify-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 font-bold text-glowza-pink shadow-sm">
            <RefreshCcw size={17} className={store.loadingMoreProducts ? 'animate-spin' : ''} />
            {store.loadingMoreProducts ? 'Loading more products...' : 'Scroll for more'}
          </div>
        </div>
      )}
    </section>
  );
}

function CategoriesPage({ store, setActive, setCategory }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-5 sm:py-8 lg:px-8">
      <h1 className="mb-5 text-3xl font-black text-glowza-plum sm:mb-6 sm:text-4xl">Categories</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
        {store.categories.map((item) => (
          <button key={item.id} className="overflow-hidden rounded-[1.5rem] bg-white p-0 text-left shadow-glow sm:rounded-[2rem]" onClick={() => { setCategory(item.id); setActive('Shop'); }}>
            <div className="aspect-[1.45] bg-pink-50">
              {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="p-3 sm:p-5">
              <h2 className="line-clamp-1 text-base font-black text-glowza-plum sm:text-2xl">{item.name}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">Explore products</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfilePage({ store, onLogin, onOpenProduct }) {
  if (!store.user) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-[2rem] bg-white p-8 shadow-glow">
          <h1 className="text-4xl font-black text-glowza-plum">Login to view profile</h1>
          <p className="mt-3 text-slate-500">Track orders, wishlist, and review delivered products.</p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-glowza-pink px-6 py-4 font-bold text-white" onClick={onLogin}>
            <LogIn size={18} />
            Login
          </button>
        </div>
      </section>
    );
  }
  const wishedProducts = store.products.filter((product) => store.wishlist.has(product.id));
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:py-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
      <div className="space-y-5">
        <div className="rounded-[2rem] bg-gradient-to-br from-glowza-plum to-glowza-pink p-6 text-white shadow-glow">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-glowza-pink">
            <CircleUserRound size={34} />
          </div>
          <h1 className="mt-4 text-3xl font-black">{store.user.name}</h1>
          <p className="text-white/75">{store.user.phone}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-glow">
          <h2 className="text-xl font-black text-glowza-plum">Wishlist</h2>
          <div className="mt-4 space-y-3">
            {wishedProducts.length === 0 && <p className="text-sm text-slate-500">No wishlist products yet.</p>}
            {wishedProducts.slice(0, 6).map((product) => (
              <button key={product.id} className="flex w-full items-center gap-3 rounded-2xl bg-pink-50 p-2 text-left" onClick={() => onOpenProduct(product)}>
                <ProductThumb product={product} className="h-14 w-14 rounded-xl" />
                <div className="min-w-0">
                  <strong className="line-clamp-1 text-sm">{product.name}</strong>
                  <p className="text-sm font-bold text-glowza-pink">{money(product.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[2rem] bg-white p-5 shadow-glow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black text-glowza-plum">Orders</h2>
          <button className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 font-bold text-glowza-pink" onClick={() => store.refreshOrders()}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
        <div className="space-y-4">
          {store.orders.length === 0 && <p className="text-slate-500">No orders yet.</p>}
          {store.orders.map((order) => (
            <OrderCard key={order.id} order={order} store={store} onOpenProduct={onOpenProduct} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OrderCard({ order, store, onOpenProduct }) {
  return (
    <article className="rounded-3xl border border-pink-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="text-glowza-plum">{order.orderNumber}</strong>
          <p className="text-sm text-slate-500">{order.status} - {order.paymentMethod}</p>
        </div>
        <strong className="text-glowza-pink">{money(order.total)}</strong>
      </div>
      <div className="mt-4 grid gap-3">
        {order.products?.map((item) => {
          const product = store.products.find((entry) => entry.id === item.productId);
          return (
            <div key={`${order.id}-${item.productId}`} className="flex items-center gap-3 rounded-2xl bg-pink-50 p-2">
              {product ? <ProductThumb product={product} className="h-14 w-14 rounded-xl" /> : item.image ? <img src={item.image} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold">{item.name}</p>
                <p className="text-xs text-slate-500">Qty {item.quantity}</p>
              </div>
              {String(order.status).toLowerCase() === 'delivered' && product && (
                <button className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-glowza-pink" onClick={() => onOpenProduct(product)}>
                  <Star size={13} />
                  Review
                </button>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ProductThumb({ product, className = '' }) {
  const image = product.image || product.images?.[0] || '';
  const video = !image ? product.videos?.[0] : '';
  return (
    <div className={`relative shrink-0 overflow-hidden bg-pink-50 ${className}`}>
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : video ? (
        <>
          <video src={video} muted playsInline preload="metadata" className="h-full w-full bg-black object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
            <PlayCircle size={16} />
          </span>
        </>
      ) : (
        <div className="grid h-full w-full place-items-center text-glowza-pink">
          <Sparkles size={18} />
        </div>
      )}
      {image && product.videos?.length > 0 && (
        <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-glowza-pink">
          <PlayCircle size={12} />
        </span>
      )}
    </div>
  );
}

function ProductModal({ product, store, onClose, onBuyNow, onOpenRelated, onLogin }) {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeInfo, setActiveInfo] = useState('description');
  const [added, setAdded] = useState(false);
  const order = store.deliveredOrderForProduct(product.id);
  const reviews = product.reviews || [];
  const gallery = [
    ...(product.videos || []).filter(Boolean).map((url) => ({ type: 'video', url })),
    ...(product.images?.length ? product.images : product.image ? [product.image] : []).filter(Boolean).map((url) => ({ type: 'image', url })),
  ];
  const activeMedia = gallery[mediaIndex] || (product.image ? { type: 'image', url: product.image } : null);
  const stock = Number(product.stock ?? 0);
  const canAdd = stock !== 0;
  const hasOldPrice = Number(product.oldPrice || 0) > Number(product.price || 0);
  const discount = hasOldPrice
    ? Math.round(((Number(product.oldPrice) - Number(product.price)) / Number(product.oldPrice)) * 100)
    : Number(product.discount || 0);
  const related = store.products
    .filter((item) => item.id !== product.id && (item.categoryId === product.categoryId || item.categoryName === product.categoryName))
    .slice(0, 4);
  const descriptionHtml = sanitizeRichText(product.description);

  useEffect(() => {
    setMediaIndex(0);
    setQuantity(1);
    setActiveInfo('description');
    setAdded(false);
  }, [product.id, product.image, product.images, product.videos]);

  function moveImage(direction) {
    if (gallery.length <= 1) return;
    setMediaIndex((current) => (current + direction + gallery.length) % gallery.length);
  }

  function addSelectedToCart() {
    if (!canAdd) return;
    store.addToCart(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function toggleWishlist() {
    if (!store.user) {
      onLogin();
      return;
    }
    store.toggleWishlist(product.id);
  }

  return (
    <Modal title="Product details" onClose={onClose} full>
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
        <div className="min-w-0 space-y-3">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-pink-50 to-purple-50 sm:rounded-[1.8rem]">
            {activeMedia?.type === 'image' ? (
              <img src={activeMedia.url} alt={product.name} className="aspect-square max-h-[58dvh] w-full object-cover transition duration-300 sm:max-h-none" />
            ) : activeMedia?.type === 'video' ? (
              <video src={activeMedia.url} controls muted playsInline preload="metadata" className="aspect-square max-h-[58dvh] w-full bg-black object-cover sm:max-h-none" />
            ) : (
              <div className="grid aspect-square place-items-center text-glowza-pink">
                <Sparkles size={44} />
              </div>
            )}
            {gallery.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-glowza-plum shadow-sm"
                  onClick={() => moveImage(-1)}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-glowza-plum shadow-sm"
                  onClick={() => moveImage(1)}
                  aria-label="Next image"
                >
                  <ChevronRight size={22} />
                </button>
                <div className="hide-scrollbar absolute bottom-3 left-1/2 flex max-w-[72%] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-full bg-white/90 px-3 py-2 shadow-sm sm:bottom-4">
                  {gallery.map((item, index) => (
                    <button
                      key={`${item.url}-dot`}
                      className={`h-2.5 min-h-0 w-2.5 shrink-0 rounded-full p-0 ${index === mediaIndex ? 'bg-glowza-pink' : 'bg-pink-200'}`}
                      onClick={() => setMediaIndex(index)}
                      aria-label={`Show media ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
            {discount > 0 && (
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-2 text-xs font-black text-glowza-pink shadow-sm">
                {discount}% OFF
              </span>
            )}
            <button
              className={`absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/95 shadow-sm ${store.wishlist.has(product.id) ? 'text-glowza-pink' : 'text-glowza-plum'}`}
              onClick={toggleWishlist}
              aria-label="Wishlist"
            >
              <Heart size={20} fill={store.wishlist.has(product.id) ? 'currentColor' : 'none'} />
            </button>
          </div>

          {gallery.length > 1 && (
            <div className="hide-scrollbar flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1">
              {gallery.map((item, index) => (
                <button
                  key={`${item.url}-${index}`}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border p-0 transition sm:h-16 sm:w-16 ${mediaIndex === index ? 'border-glowza-pink ring-4 ring-pink-100' : 'border-pink-100'}`}
                  onClick={() => setMediaIndex(index)}
                >
                  {item.type === 'image' ? (
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <video src={item.url} muted playsInline preload="metadata" className="h-full w-full bg-black object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
                        <PlayCircle size={18} />
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <TrustPill icon={<Truck size={16} />} title="Delivery" text="Available" />
            <TrustPill icon={<ShieldCheck size={16} />} title="Quality" text="Checked" />
            <TrustPill icon={<CheckCircle2 size={16} />} title="Stock" text={stock > 0 ? `${stock} left` : 'Ask us'} />
          </div>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-pink-50 px-3 py-1.5 text-xs font-black uppercase text-glowza-pink">{product.categoryName || 'Glowza'}</span>
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight text-glowza-plum sm:text-3xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-3 py-2 text-sm font-bold text-yellow-700">
                <Star size={15} fill="currentColor" />
                {Number(product.rating || 0).toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-500">{reviews.length || Number(product.reviewCount || 0)} reviews</span>
              <span className={`rounded-full px-3 py-2 text-sm font-bold ${canAdd ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {canAdd ? 'In stock' : 'Out of stock'}
              </span>
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-gradient-to-br from-pink-50 to-white p-4">
            <div className="flex flex-wrap items-end gap-3">
              <strong className="text-3xl font-black text-glowza-pink sm:text-4xl">{money(product.price)}</strong>
              {hasOldPrice && <span className="pb-1 text-lg font-bold text-slate-400 line-through">{money(product.oldPrice)}</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Delivery available across supported cities.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-pink-100 bg-white p-1">
              <button className="grid h-10 w-10 place-items-center rounded-full bg-pink-50 text-glowza-pink disabled:opacity-40" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                <Minus size={17} />
              </button>
              <span className="w-12 text-center text-lg font-black text-glowza-plum">{quantity}</span>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-pink-50 text-glowza-pink disabled:opacity-40" disabled={stock > 0 && quantity >= stock} onClick={() => setQuantity((value) => stock > 0 ? Math.min(stock, value + 1) : value + 1)}>
                <Plus size={17} />
              </button>
            </div>
            {added && <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-3 text-sm font-bold text-green-700"><CheckCircle2 size={16} /> Added to cart</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button disabled={!canAdd} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-pink px-6 py-4 font-bold text-white shadow-lg shadow-pink-200 disabled:opacity-50" onClick={addSelectedToCart}>
              <ShoppingBag size={18} />
              Add to Cart
            </button>
            <button disabled={!canAdd} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-plum px-6 py-4 font-bold text-white disabled:opacity-50" onClick={() => onBuyNow(product, quantity)}>
              <PackageCheck size={18} />
              Buy Now
            </button>
          </div>

          <div className="rounded-3xl border border-pink-100 bg-white p-3">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-pink-50 p-1">
              {[
                ['description', 'Details'],
                ['ingredients', 'Ingredients'],
                ['usage', 'How to use'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`rounded-xl px-2 py-2 text-xs font-black transition sm:text-sm ${activeInfo === key ? 'bg-white text-glowza-pink shadow-sm' : 'text-slate-500'}`}
                  onClick={() => setActiveInfo(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="product-rich-text p-3 text-sm font-semibold leading-6 text-slate-600">
              {activeInfo === 'description' && (
                descriptionHtml
                  ? <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                  : 'A curated Glowza beauty essential selected for everyday routines and premium gifting.'
              )}
              {activeInfo === 'ingredients' && (product.ingredients || 'Ingredient details will be updated soon. Always patch test before regular use.')}
              {activeInfo === 'usage' && (product.howToUse || product.howTo || 'Apply as needed according to your beauty routine. Store in a cool, dry place.')}
            </div>
          </div>

          <div className="rounded-3xl border border-pink-100 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-glowza-plum">Customer Reviews</h2>
                <p className="text-sm text-slate-500">{reviews.length} public reviews</p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 font-bold text-glowza-pink disabled:opacity-50"
                disabled={!order}
                onClick={() => store.user ? setReviewOpen(true) : onLogin()}
              >
                <Star size={15} />
                Review
              </button>
            </div>
            {!order && <p className="mt-3 rounded-2xl bg-pink-50 p-3 text-sm font-bold text-slate-600">Reviews unlock after this product is delivered to you.</p>}
            <div className="mt-4 space-y-3">
              {reviews.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No public reviews yet.</p>}
              {reviews.slice(0, 4).map((review, index) => (
                <div key={`${review.customerName}-${index}`} className="rounded-2xl bg-pink-50 p-3">
                  <div className="flex justify-between gap-3">
                    <strong>{review.customerName || 'Glowza customer'}</strong>
                    <span className="inline-flex items-center gap-1 font-bold text-glowza-gold"><Star size={14} fill="currentColor" /> {review.rating}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>

          {related.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-black text-glowza-plum">Related Products</h2>
                <span className="text-xs font-bold uppercase text-glowza-pink">Same category</span>
              </div>
              <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
                {related.map((item) => (
                  <button key={item.id} className="w-36 shrink-0 rounded-2xl border border-pink-100 bg-white p-2 text-left" onClick={() => onOpenRelated(item)}>
                    <div className="aspect-square overflow-hidden rounded-xl bg-pink-50">
                      <ProductThumb product={item} className="h-full w-full rounded-none" />
                    </div>
                    <strong className="mt-2 block line-clamp-2 text-xs text-glowza-plum">{item.name}</strong>
                    <p className="mt-1 text-sm font-black text-glowza-pink">{money(item.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {reviewOpen && <ReviewForm product={product} order={order} store={store} onClose={() => setReviewOpen(false)} />}
    </Modal>
  );
}

function TrustPill({ icon, title, text }) {
  return (
    <div className="rounded-2xl bg-pink-50 p-3 text-center">
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-white text-glowza-pink">{icon}</div>
      <p className="mt-2 text-xs font-black text-glowza-plum">{title}</p>
      <p className="text-[11px] font-semibold text-slate-500">{text}</p>
    </div>
  );
}

function ReviewForm({ product, order, store, onClose }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (await store.userAlreadyReviewed(product.id, order.id)) throw new Error('You already reviewed this delivered item.');
      await store.reviewProduct({ product, order, rating, comment });
      setMessage('Review submitted for moderation.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not submit review.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4">
      <form className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl" onSubmit={submit}>
        <div className="mb-4 flex justify-between gap-4">
          <h3 className="text-xl font-black text-glowza-plum">Write Review</h3>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-pink-50 text-glowza-pink" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="mb-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" className="bg-transparent p-1 text-glowza-gold" onClick={() => setRating(star)}>
              <Star size={34} fill={rating >= star ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <textarea className="focus-ring min-h-32 w-full rounded-2xl border border-pink-100 p-4" required minLength={8} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share your experience..." />
        {message && <p className="mt-3 rounded-2xl bg-pink-50 p-3 text-sm font-bold text-glowza-pink">{message}</p>}
        <button disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-pink px-5 py-4 font-bold text-white">
          <Star size={17} />
          {busy ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}

function LoginModal({ store, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+92');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await store.login({ name, phone });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Login to Glowza" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-3xl bg-gradient-to-br from-pink-50 to-purple-50 p-4">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-glowza-pink shadow-sm">
            <CircleUserRound size={26} />
          </div>
          <p className="text-sm font-semibold text-slate-600">Login with your name and Pakistan mobile number. No OTP is required for the website preview.</p>
        </div>
        <input className="focus-ring w-full rounded-2xl border border-pink-100 px-4 py-4" required placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="focus-ring w-full rounded-2xl border border-pink-100 px-4 py-4" required placeholder="+92 phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-pink px-5 py-4 font-bold text-white shadow-lg shadow-pink-200">
          <LogIn size={18} />
          {busy ? 'Logging in...' : 'Continue'}
        </button>
      </form>
    </Modal>
  );
}

function CartModal({ store, onClose, onCheckout }) {
  return (
    <Modal title="Shopping Cart" onClose={onClose}>
      <div className="space-y-4">
        {store.cart.length === 0 && <p className="rounded-2xl bg-pink-50 p-4 text-slate-500">Your cart is empty.</p>}
        {store.cart.map((item) => (
          <div key={item.product.id} className="flex items-center gap-3 rounded-2xl border border-pink-100 p-3">
            <ProductThumb product={item.product} className="h-16 w-16 rounded-xl" />
            <div className="min-w-0 flex-1">
              <strong className="line-clamp-1">{item.product.name}</strong>
              <p className="text-sm font-bold text-glowza-pink">{money(item.product.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="grid h-9 w-9 place-items-center rounded-full bg-pink-50 text-glowza-pink" onClick={() => store.updateCart(item.product.id, item.quantity - 1)}>
                <Minus size={16} />
              </button>
              <span className="font-black">{item.quantity}</span>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-pink-50 text-glowza-pink" onClick={() => store.updateCart(item.product.id, item.quantity + 1)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        ))}
        <div className="rounded-3xl bg-pink-50 p-4">
          <Line label="Subtotal" value={store.subtotal} />
          <Line label="Delivery" value={store.shippingFee} />
          <Line label="Total" value={store.total} strong />
        </div>
        <button disabled={store.cart.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-pink px-5 py-4 font-bold text-white disabled:opacity-50" onClick={onCheckout}>
          <PackageCheck size={18} />
          Checkout
        </button>
      </div>
    </Modal>
  );
}

function CheckoutModal({ store, onClose, onComplete }) {
  const [form, setForm] = useState({
    fullName: store.checkoutInfo.fullName || store.user?.name || '',
    phone: store.checkoutInfo.phone || store.user?.phone || '',
    city: store.checkoutInfo.city || '',
    area: store.checkoutInfo.area || '',
    address: store.checkoutInfo.address || '',
    nearbyPlace: store.checkoutInfo.nearbyPlace || '',
  });
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      onComplete(await store.placeOrder(form));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Checkout" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        {[
          ['fullName', 'Full name'],
          ['phone', '+92 phone number'],
          ['city', 'City'],
          ['area', 'Area / locality'],
          ['nearbyPlace', 'Famous place near your location'],
          ['address', 'Complete delivery address'],
        ].map(([field, label]) => (
          <input key={field} className="focus-ring w-full rounded-2xl border border-pink-100 px-4 py-4" required placeholder={label} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
        ))}
        <div className="rounded-3xl bg-pink-50 p-4">
          <Line label="Subtotal" value={store.subtotal} />
          <Line label="Delivery" value={store.shippingFee} />
          <Line label="Total" value={store.total} strong />
        </div>
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-glowza-pink px-5 py-4 font-bold text-white">
          <PackageCheck size={18} />
          {busy ? 'Placing...' : 'Place Order'}
        </button>
      </form>
    </Modal>
  );
}

function Line({ label, value, strong }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'text-lg font-black text-glowza-pink' : 'font-bold text-slate-600'}`}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function PrivacyPolicyPage() {
  const sections = [
    {
      title: 'Information we collect',
      body: 'Glowza may collect your name, phone number, delivery address, city, area, order details, cart activity, wishlist activity, product reviews, and device information needed for account, checkout, support, analytics, and notifications.',
    },
    {
      title: 'How we use information',
      body: 'We use your information to process cash-on-delivery orders, manage customer support, show product availability, improve shopping experience, prevent abuse, send order or promotional updates where permitted, and maintain app and website security.',
    },
    {
      title: 'Payments and orders',
      body: 'Glowza currently supports Cash on Delivery. We do not collect debit card, credit card, or online banking credentials on this website.',
    },
    {
      title: 'Firebase and service providers',
      body: 'Glowza uses Firebase services such as Firestore for app data and may use Cloudinary for product media. These providers process data only to support Glowza services, storage, delivery, security, and analytics.',
    },
    {
      title: 'Advertising and rewards',
      body: 'Glowza may use advertising SDKs for rewarded ads inside games or rewards features. Rewards are calculated internally and may be limited by daily caps, anti-abuse checks, order minimums, and promotional rules.',
    },
    {
      title: 'Data retention',
      body: 'We keep order and account information for as long as needed to provide service, meet business requirements, resolve disputes, prevent fraud, and comply with applicable obligations.',
    },
    {
      title: 'Your choices',
      body: 'You may contact Glowza to request correction or deletion of your account details where legally and operationally possible. Some order records may be retained for business, fraud prevention, or compliance reasons.',
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12 lg:px-8">
      <div className="rounded-[2rem] bg-gradient-to-br from-glowza-plum via-glowza-pink to-glowza-hot p-6 text-white shadow-glow sm:p-10">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
          <ShieldCheck size={30} />
        </div>
        <p className="text-sm font-black uppercase text-white/70">Glowza Pakistan</p>
        <h1 className="mt-2 text-4xl font-black leading-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-white/78 sm:text-base">
          This policy explains how Glowza collects, uses, and protects information across our cosmetics ecommerce website,
          mobile app, admin operations, rewards features, and customer support.
        </p>
        <p className="mt-5 rounded-2xl bg-white/12 px-4 py-3 text-sm font-bold text-white/85">
          Last updated: May 21, 2026
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        {sections.map((section) => (
          <article key={section.title} className="rounded-[1.6rem] border border-pink-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-glowza-plum">{section.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">{section.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-[1.6rem] bg-pink-50 p-5 sm:p-6">
        <h2 className="text-xl font-black text-glowza-plum">Contact</h2>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          For privacy questions or account support, contact Glowza support through the website, app, or official customer
          support channel. We may ask for your phone number or order number to verify your request.
        </p>
      </div>
    </section>
  );
}

function Footer({ onPrivacy }) {
  return (
    <footer className="mt-16 hidden border-t border-pink-100 bg-white md:block">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-3 lg:px-8">
        <div>
          <img src="/app-icon-dot.png" alt="Glowza" className="h-14 w-14 rounded-2xl" />
          <h2 className="mt-4 text-2xl font-black text-glowza-plum">Glowza</h2>
          <p className="mt-2 text-sm text-slate-500">Pakistan-based cosmetics ecommerce powered by Firebase.</p>
        </div>
        <div>
          <h3 className="font-black text-glowza-plum">Shopping</h3>
          <p className="mt-2 text-sm text-slate-500">Cloudinary media, Firestore products, and review moderation.</p>
        </div>
        <div>
          <h3 className="font-black text-glowza-plum">Support</h3>
          <p className="mt-2 text-sm text-slate-500">Orders are managed from the Glowza admin panel.</p>
          <button className="mt-3 bg-transparent p-0 text-sm font-black text-glowza-pink" onClick={onPrivacy}>
            Privacy Policy
          </button>
        </div>
      </div>
    </footer>
  );
}
