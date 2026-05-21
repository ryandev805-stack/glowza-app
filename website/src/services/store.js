import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
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
