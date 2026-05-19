import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Banner, Category, DeviceToken, NotificationCampaign, Order, Product, ProductReview, Review, User } from '../types';

const paths = {
  users: 'users',
  categories: 'categories',
  banners: 'banners',
  products: 'products',
  orders: 'orders',
  reviews: 'reviews',
  deviceTokens: 'device_tokens',
  notificationCampaigns: 'notification_campaigns',
} as const;

const withId = <T>(snapshot: QueryDocumentSnapshot<DocumentData>) =>
  ({ id: snapshot.id, ...snapshot.data() }) as T;

async function readApiJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || fallbackMessage);
  }
  if (!response.ok) {
    throw new Error((body.error as string | undefined) || fallbackMessage);
  }
  return body as T;
}

export async function listCategories(): Promise<Category[]> {
  const snapshot = await getDocs(query(collection(db, paths.categories), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => withId<Category>(doc));
}

export async function saveCategory(input: Omit<Category, 'id'> & { id?: string }) {
  const payload = {
    name: input.name.trim(),
    image: input.image.trim(),
    isActive: input.isActive,
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, paths.categories, input.id), payload);
    return input.id;
  }
  const created = await addDoc(collection(db, paths.categories), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, paths.categories, id));
}

export async function listBanners(): Promise<Banner[]> {
  const snapshot = await getDocs(query(collection(db, paths.banners), orderBy('sortOrder', 'asc')));
  return snapshot.docs.map((doc) => withId<Banner>(doc));
}

export async function saveBanner(input: Omit<Banner, 'id'> & { id?: string }) {
  const payload = {
    title: input.title.trim(),
    image: input.image.trim(),
    link: input.link.trim(),
    isActive: input.isActive,
    sortOrder: Number(input.sortOrder) || 0,
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, paths.banners, input.id), payload);
    return input.id;
  }
  const created = await addDoc(collection(db, paths.banners), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteBanner(id: string) {
  await deleteDoc(doc(db, paths.banners, id));
}

export async function listProducts(): Promise<Product[]> {
  const snapshot = await getDocs(query(collection(db, paths.products), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => withId<Product>(doc));
}

export async function saveProduct(input: Omit<Product, 'id'> & { id?: string }) {
  const images = (input.images || [])
    .map((image) => image.trim())
    .filter(Boolean);
  const mainImage = input.image.trim() || images[0] || '';
  const price = Number(input.price) || 0;
  const oldPrice = Number(input.oldPrice) || price;
  const discount =
    oldPrice > price && oldPrice > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0;
  const reviews = (input.reviews || []).map((review) => ({
    customerName: review.customerName.trim(),
    rating: Number(review.rating) || 0,
    comment: review.comment.trim(),
    createdAt: review.createdAt || new Date().toISOString(),
  }));
  const reviewCount = reviews.length || Number(input.reviewCount) || 0;
  const rating =
    reviews.length > 0
      ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1))
      : Number(input.rating) || 0;

  const payload = {
    name: input.name.trim(),
    description: input.description.trim(),
    price,
    categoryId: input.categoryId,
    image: mainImage,
    images: [mainImage, ...images.filter((image) => image !== mainImage)].filter(Boolean),
    stock: Number(input.stock) || 0,
    isActive: input.isActive,
    brand: input.brand?.trim() || 'Glowza',
    productType: input.productType?.trim() || '',
    skinType: input.skinType?.trim() || 'All',
    oldPrice,
    discount,
    rating,
    reviewCount,
    reviews,
    ingredients: input.ingredients?.trim() || '',
    howToUse: input.howToUse?.trim() || '',
    isNew: Boolean(input.isNew),
    isBestSeller: Boolean(input.isBestSeller),
    isFlashSale: Boolean(input.isFlashSale),
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, paths.products, input.id), payload);
    return input.id;
  }
  const created = await addDoc(collection(db, paths.products), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(db, paths.products, id));
}

export async function updateProductReviews(productId: string, inputReviews: ProductReview[]) {
  const reviews = inputReviews.map((review) => ({
    customerName: review.customerName.trim(),
    rating: Number(review.rating) || 0,
    comment: review.comment.trim(),
    createdAt: review.createdAt || new Date().toISOString(),
  }));
  const rating =
    reviews.length > 0
      ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1))
      : 0;

  await updateDoc(doc(db, paths.products, productId), {
    reviews,
    rating,
    reviewCount: reviews.length,
    updatedAt: serverTimestamp(),
  });
}

export async function listReviews(): Promise<Review[]> {
  const snapshot = await getDocs(query(collection(db, paths.reviews), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => withId<Review>(doc));
}

export async function updateReviewStatus(review: Review, status: Review['status']) {
  await updateDoc(doc(db, paths.reviews, review.id), {
    status,
    updatedAt: serverTimestamp(),
  });
  await syncProductApprovedReviews(review.productId);
}

export async function deleteReview(review: Review) {
  await deleteDoc(doc(db, paths.reviews, review.id));
  await syncProductApprovedReviews(review.productId);
}

async function syncProductApprovedReviews(productId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, paths.reviews),
      where('productId', '==', productId),
    ),
  );
  const approvedReviews = snapshot.docs
    .map((doc) => withId<Review>(doc))
    .filter((review) => review.status === 'approved');
  const publicReviews = approvedReviews.map((review) => ({
    customerName: review.customerName,
    rating: Number(review.rating) || 0,
    comment: review.comment,
    createdAt: typeof review.createdAt === 'string' ? review.createdAt : new Date().toISOString(),
  }));
  const rating =
    publicReviews.length > 0
      ? Number((publicReviews.reduce((total, review) => total + Number(review.rating || 0), 0) / publicReviews.length).toFixed(1))
      : 0;

  await updateDoc(doc(db, paths.products, productId), {
    reviews: publicReviews,
    rating,
    reviewCount: publicReviews.length,
    updatedAt: serverTimestamp(),
  });
}

export async function listDeviceTokens(): Promise<DeviceToken[]> {
  const snapshot = await getDocs(query(collection(db, paths.deviceTokens), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map((doc) => withId<DeviceToken>(doc));
}

export async function listNotificationCampaigns(): Promise<NotificationCampaign[]> {
  const snapshot = await getDocs(query(collection(db, paths.notificationCampaigns), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => withId<NotificationCampaign>(doc));
}

export async function sendNotificationCampaign(input: Omit<NotificationCampaign, 'id' | 'status' | 'sentCount'>) {
  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readApiJson<{ campaignId: string; sentCount: number }>(
    response,
    'Could not send notification',
  );
}

export async function listUsers(): Promise<User[]> {
  const snapshot = await getDocs(query(collection(db, paths.users), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => withId<User>(doc));
}

export async function listOrders(): Promise<Order[]> {
  const snapshot = await getDocs(query(collection(db, paths.orders), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((doc) => withId<Order>(doc));
}

export async function updateOrderStatus(id: string, status: string) {
  await updateDoc(doc(db, paths.orders, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}
