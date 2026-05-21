import { useEffect, useMemo, useState } from 'react';
import {
  createOrder,
  fetchActiveBanners,
  fetchActiveCategories,
  fetchActiveProductPage,
  fetchProductById,
  fetchOrdersForUser,
  hasReviewForOrderProduct,
  loginOrCreateUser,
  submitReview,
} from '../services/store';

const userKey = 'glowza_web_user';
const checkoutKey = 'glowza_web_checkout';
const productPageSize = 20;

export function useGlowzaStore() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(userKey);
    return saved ? JSON.parse(saved) : null;
  });
  const [checkoutInfo, setCheckoutInfo] = useState(() => {
    const saved = localStorage.getItem(checkoutKey);
    return saved ? JSON.parse(saved) : { fullName: '', phone: '', city: '', area: '', address: '' };
  });
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCursor, setProductCursor] = useState(null);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + Number(item.product.price || 0) * item.quantity, 0),
    [cart],
  );
  const shippingFee = cart.length > 0 ? 250 : 0;
  const discount = 0;
  const total = subtotal + shippingFee - discount;
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (user?.id) {
      void refreshOrders(user.id);
    }
  }, [user?.id]);

  async function loadCatalog() {
    setLoading(true);
    setError('');
    try {
      const [categoryData, bannerData] = await Promise.all([
        fetchActiveCategories(),
        fetchActiveBanners(),
      ]);
      const productPage = await fetchActiveProductPage({
        categoryList: categoryData,
        pageSize: productPageSize,
      });
      setCategories(categoryData);
      setBanners(bannerData);
      setProducts(productPage.products);
      setProductCursor(productPage.cursor);
      setHasMoreProducts(productPage.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load store');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreProducts() {
    if (!hasMoreProducts || loadingMoreProducts) return;
    setLoadingMoreProducts(true);
    setError('');
    try {
      const productPage = await fetchActiveProductPage({
        categoryList: categories,
        pageSize: productPageSize,
        cursor: productCursor,
      });
      setProducts((current) => {
        const byId = new Map(current.map((product) => [product.id, product]));
        productPage.products.forEach((product) => byId.set(product.id, product));
        return [...byId.values()];
      });
      setProductCursor(productPage.cursor);
      setHasMoreProducts(productPage.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more products');
    } finally {
      setLoadingMoreProducts(false);
    }
  }

  async function loadProductById(productId) {
    const existing = products.find((product) => product.id === productId);
    if (existing) return existing;
    const product = await fetchProductById(productId, categories);
    if (product) {
      setProducts((current) => current.some((item) => item.id === product.id) ? current : [product, ...current]);
    }
    return product;
  }

  async function refreshOrders(userId = user?.id) {
    if (!userId) return;
    setOrders(await fetchOrdersForUser(userId));
  }

  async function login(credentials) {
    const profile = await loginOrCreateUser(credentials);
    setUser(profile);
    localStorage.setItem(userKey, JSON.stringify(profile));
    await refreshOrders(profile.id);
  }

  function logout() {
    setUser(null);
    setOrders([]);
    setCart([]);
    setWishlist(new Set());
    localStorage.removeItem(userKey);
  }

  function addToCart(product, quantity = 1) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...current, { product, quantity }];
    });
  }

  function updateCart(productId, quantity) {
    setCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.product.id !== productId)
        : current.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
    );
  }

  function toggleWishlist(productId) {
    setWishlist((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function saveCheckout(info) {
    setCheckoutInfo(info);
    localStorage.setItem(checkoutKey, JSON.stringify(info));
  }

  async function placeOrder(info) {
    if (!user) throw new Error('Login is required');
    const created = await createOrder({
      user,
      checkout: info,
      items: cart,
      subtotal,
      shippingFee,
      discount,
      total,
    });
    saveCheckout(info);
    setCart([]);
    await refreshOrders(user.id);
    return created;
  }

  function deliveredOrderForProduct(productId) {
    return orders.find(
      (order) =>
        String(order.status || '').toLowerCase() === 'delivered' &&
        order.products?.some((product) => product.productId === productId),
    );
  }

  async function userAlreadyReviewed(productId, orderId) {
    if (!user) return false;
    return hasReviewForOrderProduct({ userId: user.id, productId, orderId });
  }

  async function reviewProduct({ product, order, rating, comment }) {
    if (!user) throw new Error('Login is required');
    await submitReview({ user, product, order, rating, comment });
  }

  return {
    user,
    categories,
    banners,
    products,
    orders,
    cart,
    wishlist,
    checkoutInfo,
    loading,
    loadingMoreProducts,
    hasMoreProducts,
    error,
    subtotal,
    shippingFee,
    discount,
    total,
    cartCount,
    loadCatalog,
    loadMoreProducts,
    loadProductById,
    login,
    logout,
    addToCart,
    updateCart,
    toggleWishlist,
    saveCheckout,
    placeOrder,
    refreshOrders,
    deliveredOrderForProduct,
    userAlreadyReviewed,
    reviewProduct,
  };
}
