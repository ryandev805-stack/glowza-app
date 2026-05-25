import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const paths = {
  users: 'users',
  categories: 'categories',
  banners: 'banners',
  products: 'products',
  orders: 'orders',
  reviews: 'reviews',
};

const withId = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

function searchTerms(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 10);
}

function hashNumber(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function productRotationSeed(date = new Date()) {
  return Math.floor(date.getTime() / (10 * 60 * 1000));
}

export function rankProducts(products, seed = productRotationSeed()) {
  return [...products].sort((a, b) => {
    const aScore =
      hashNumber(`${a.id}-${seed}`) +
      Math.log1p(Number(a.viewCount || 0)) * 0.18 +
      Number(a.rating || 0) * 0.05 +
      Math.log1p(Number(a.reviewCount || 0)) * 0.04;
    const bScore =
      hashNumber(`${b.id}-${seed}`) +
      Math.log1p(Number(b.viewCount || 0)) * 0.18 +
      Number(b.rating || 0) * 0.05 +
      Math.log1p(Number(b.reviewCount || 0)) * 0.04;
    return bScore - aScore;
  });
}

export function interleaveProductsByCategory(products, seed = productRotationSeed()) {
  const buckets = new Map();
  products.forEach((product) => {
    const key = product.categoryId || product.categoryName || 'uncategorized';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(product);
  });

  const categories = [...buckets.keys()].sort(
    (a, b) => hashNumber(`${a}-${seed}-category`) - hashNumber(`${b}-${seed}-category`),
  );
  categories.forEach((category) => {
    buckets.set(category, rankProducts(buckets.get(category), seed));
  });

  const result = [];
  let hasProducts = true;
  while (hasProducts) {
    hasProducts = false;
    categories.forEach((category) => {
      const bucket = buckets.get(category);
      if (bucket?.length) {
        result.push(bucket.shift());
        hasProducts = true;
      }
    });
  }
  return result;
}

export async function loginOrCreateUser({ name, phone }) {
  const snapshot = await getDocs(
    query(collection(db, paths.users), where('phone', '==', phone), limit(1)),
  );

  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    await updateDoc(doc(db, paths.users, userDoc.id), {
      name: name.trim() || userDoc.data().name || '',
      updatedAt: serverTimestamp(),
    });
    return { id: userDoc.id, ...userDoc.data(), name: name.trim() || userDoc.data().name };
  }

  const created = await addDoc(collection(db, paths.users), {
    name: name.trim(),
    phone,
    role: 'customer',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: created.id, name: name.trim(), phone, role: 'customer' };
}

export async function fetchActiveCategories() {
  const snapshot = await getDocs(query(collection(db, paths.categories), where('isActive', '==', true)));
  return snapshot.docs.map(withId).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchActiveBanners() {
  const snapshot = await getDocs(query(collection(db, paths.banners), where('isActive', '==', true)));
  return snapshot.docs.map(withId).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function mapProducts(productSnapshot, categoryList) {
  const categoryById = new Map(categoryList.map((category) => [category.id, category.name]));
  return productSnapshot.docs
    .map((document) => {
      const product = withId(document);
      return {
        ...product,
        categoryName: categoryById.get(product.categoryId) || '',
        images: product.images?.length ? product.images : product.image ? [product.image] : [],
        videos: product.videos?.length ? product.videos : [],
      };
    });
}

export async function fetchActiveProductPage({ categoryList, pageSize = 20, cursor = null }) {
  const constraints = [
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];
  if (cursor) {
    constraints.splice(2, 0, startAfter(cursor));
  }
  const productSnapshot = await getDocs(query(collection(db, paths.products), ...constraints));
  const products = mapProducts(productSnapshot, categoryList);
  return {
    products,
    cursor: productSnapshot.docs[productSnapshot.docs.length - 1] || null,
    hasMore: productSnapshot.docs.length === pageSize,
  };
}

export async function fetchActiveProductsByCategory({ categoryId, categoryList, pageSize = 160 }) {
  if (!categoryId || categoryId === 'all') {
    const page = await fetchActiveProductPage({ categoryList, pageSize });
    return page.products;
  }

  const snapshot = await getDocs(
    query(
      collection(db, paths.products),
      where('isActive', '==', true),
      where('categoryId', '==', categoryId),
      limit(pageSize),
    ),
  );
  return rankProducts(mapProducts(snapshot, categoryList));
}

export async function searchActiveProducts({ text, categoryList, pageSize = 60 }) {
  const terms = searchTerms(text);
  if (terms.length === 0) {
    const page = await fetchActiveProductPage({ categoryList, pageSize });
    return { products: page.products, suggestions: [] };
  }

  try {
    const snapshot = await getDocs(
      query(
        collection(db, paths.products),
        where('isActive', '==', true),
        where('searchTokens', 'array-contains-any', terms),
        limit(pageSize),
      ),
    );
    const products = rankProducts(mapProducts(snapshot, categoryList));
    return { products, suggestions: buildSuggestions(products, terms) };
  } catch {
    const fallbackSnapshot = await getDocs(
      query(collection(db, paths.products), where('isActive', '==', true), limit(120)),
    );
    const joined = terms.join(' ');
    const products = rankProducts(mapProducts(fallbackSnapshot, categoryList).filter((product) => {
      const textBody = `${product.name || ''} ${product.description || ''} ${product.categoryName || ''} ${product.brand || ''} ${product.productType || ''} ${product.searchText || ''}`.toLowerCase();
      return terms.every((term) => textBody.includes(term)) || textBody.includes(joined);
    })).slice(0, pageSize);
    return { products, suggestions: buildSuggestions(products, terms) };
  }
}

function buildSuggestions(products, terms) {
  const suggestions = new Set();
  products.slice(0, 12).forEach((product) => {
    if (product.name) suggestions.add(product.name);
    if (product.categoryName) suggestions.add(product.categoryName);
    if (product.productType) suggestions.add(product.productType);
  });
  terms.forEach((term) => suggestions.add(term));
  return [...suggestions].filter(Boolean).slice(0, 8);
}

export async function trackProductView(productId) {
  if (!productId) return;
  try {
    await updateDoc(doc(db, paths.products, productId), {
      viewCount: increment(1),
      viewedAt: serverTimestamp(),
    });
  } catch {
    // View tracking must never block product navigation.
  }
}

export async function fetchProductById(id, categoryList) {
  const snapshot = await getDoc(doc(db, paths.products, id));
  if (!snapshot.exists()) return null;
  const product = withId(snapshot);
  if (!product.isActive) return null;
  const categoryById = new Map(categoryList.map((category) => [category.id, category.name]));
  return {
    ...product,
    categoryName: categoryById.get(product.categoryId) || '',
    images: product.images?.length ? product.images : product.image ? [product.image] : [],
    videos: product.videos?.length ? product.videos : [],
  };
}

export async function fetchActiveProducts() {
  const categoryList = await fetchActiveCategories();
  const page = await fetchActiveProductPage({ categoryList, pageSize: 20 });
  return page.products;
}

export async function fetchOrdersForUser(userId) {
  if (!userId) return [];
  const snapshot = await getDocs(query(collection(db, paths.orders), where('userId', '==', userId)));
  return snapshot.docs
    .map(withId)
    .sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));
}

export async function createOrder({ user, checkout, items, subtotal, shippingFee, discount, total }) {
  const orderNumber = `GLZ-${String(Date.now()).slice(-8)}`;
  const products = items.map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    price: Number(item.product.price || 0),
    quantity: item.quantity,
    image: item.product.image || item.product.images?.[0] || '',
  }));

  const created = await addDoc(collection(db, paths.orders), {
    userId: user.id,
    orderNumber,
    status: 'pending',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'unpaid',
    subtotal,
    shippingFee,
    discount,
    total,
    totalItems: items.reduce((count, item) => count + item.quantity, 0),
    customerName: checkout.fullName,
    customerPhone: checkout.phone,
    city: checkout.city,
    address: checkout.address,
    notes: checkout.area,
    nearbyPlace: checkout.nearbyPlace || '',
    products,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: created.id, orderNumber };
}

export async function hasReviewForOrderProduct({ userId, orderId, productId }) {
  const snapshot = await getDocs(query(collection(db, paths.reviews), where('userId', '==', userId)));
  return snapshot.docs.some((reviewDoc) => {
    const review = reviewDoc.data();
    return review.orderId === orderId && review.productId === productId;
  });
}

export async function submitReview({ user, product, order, rating, comment }) {
  await addDoc(collection(db, paths.reviews), {
    userId: user.id,
    productId: product.id,
    orderId: order.id,
    rating,
    comment: comment.trim(),
    customerName: user.name,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
