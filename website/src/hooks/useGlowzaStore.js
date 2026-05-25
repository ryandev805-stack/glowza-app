import { useEffect, useMemo, useState } from 'react';
import {
  createOrder,
  fetchActiveBanners,
  fetchActiveCategories,
  fetchDirectListingByCategories,
  fetchDirectListingMore,
  fetchActiveProductsByCategory,
  shuffleDirectListing,
  rankProducts,
  fetchProductById,
  fetchOrdersForUser,
  hasReviewForOrderProduct,
  loginOrCreateUser,
  searchActiveProducts,
  submitReview,
  trackProductView,
} from '../services/store';

function mergeCatalogProducts(current, incoming) {
  const ids = new Set(current.map((product) => product.id));
  const merged = [...current];
  incoming.forEach((product) => {
    if (!ids.has(product.id)) {
      ids.add(product.id);
      merged.push(product);
    }
  });
  return merged;
}

const userKey = 'glowza_web_user';
const checkoutKey = 'glowza_web_checkout';
const productsPerCategory = 16;

export function useGlowzaStore() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(userKey);
    return saved ? JSON.parse(saved) : null;
  });
  const [checkoutInfo, setCheckoutInfo] = useState(() => {
    const saved = localStorage.getItem(checkoutKey);
    return saved ? JSON.parse(saved) : { fullName: '', phone: '', city: '', area: '', address: '', nearbyPlace: '' };
  });
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [categoryResults, setCategoryResults] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryListingStates, setCategoryListingStates] = useState({});
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rotationSeed] = useState(() => Math.floor(Date.now() / (10 * 60 * 1000)));

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + Number(item.product.price || 0) * item.quantity, 0),
    [cart],
  );
  const shippingFee = cart.length > 0 ? 250 : 0;
  const discount = 0;
  const total = subtotal + shippingFee - discount;
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const products = useMemo(
    () => shuffleDirectListing(catalogProducts, rotationSeed),
    [catalogProducts, rotationSeed],
  );

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
      const listing = await fetchDirectListingByCategories(categoryData, {
        perCategory: productsPerCategory,
      });
      setCategories(categoryData);
      setBanners(bannerData);
      setCatalogProducts(listing.products);
      setCategoryListingStates(listing.categoryStates);
      setHasMoreProducts(listing.hasMore);
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
      const listing = await fetchDirectListingMore(categories, categoryListingStates, {
        perCategory: productsPerCategory,
      });
      setCatalogProducts((current) => mergeCatalogProducts(current, listing.products));
      setCategoryListingStates(listing.categoryStates);
      setHasMoreProducts(listing.hasMore);
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
      setCatalogProducts((current) => (
        current.some((item) => item.id === product.id) ? current : [...current, product]
      ));
    }
    return product;
  }

  async function searchCatalog(text) {
    const queryText = String(text || '').trim();
    if (!queryText) {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const result = await searchActiveProducts({
        text: queryText,
        categoryList: categories,
        pageSize: 80,
      });
      setSearchResults(result.products);
      setSearchSuggestions(result.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search products');
    } finally {
      setSearching(false);
    }
  }

  async function loadCategoryProducts(categoryId) {
    if (!categoryId || categoryId === 'all') {
      setCategoryResults([]);
      return;
    }
    setCategoryLoading(true);
    setError('');
    try {
      const result = await fetchActiveProductsByCategory({
        categoryId,
        categoryList: categories,
      });
      setCategoryResults(rankProducts(result, rotationSeed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load category products');
      setCategoryResults([]);
    } finally {
      setCategoryLoading(false);
    }
  }

  function rankedProducts(list = products) {
    return rankProducts(list, rotationSeed);
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

  async function placeOrder(info, orderItems = cart) {
    if (!user) throw new Error('Login is required');
    const orderSubtotal = orderItems.reduce((totalValue, item) => (
      totalValue + Number(item.product.price || 0) * item.quantity
    ), 0);
    const orderShippingFee = orderItems.length > 0 ? 250 : 0;
    const orderDiscount = 0;
    const created = await createOrder({
      user,
      checkout: info,
      items: orderItems,
      subtotal: orderSubtotal,
      shippingFee: orderShippingFee,
      discount: orderDiscount,
      total: orderSubtotal + orderShippingFee - orderDiscount,
    });
    saveCheckout(info);
    if (orderItems === cart) {
      setCart([]);
    }
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
    searchResults,
    searchSuggestions,
    searching,
    categoryResults,
    categoryLoading,
    orders,
    cart,
    wishlist,
    checkoutInfo,
    loading,
    loadingMoreProducts,
    hasMoreProducts,
    rotationSeed,
    error,
    subtotal,
    shippingFee,
    discount,
    total,
    cartCount,
    loadCatalog,
    loadMoreProducts,
    loadProductById,
    searchCatalog,
    loadCategoryProducts,
    rankedProducts,
    trackProductView,
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
