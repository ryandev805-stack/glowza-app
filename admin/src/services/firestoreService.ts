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
  writeBatch,
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

function cloudinaryPublicId(url: string) {
  try {
    const parsed = new URL(url);
    const afterUpload = parsed.pathname.split('/upload/')[1];
    if (!afterUpload) return '';
    const parts = afterUpload.split('/').filter(Boolean);
    const glowzaIndex = parts.findIndex((part) => part === 'glowza');
    const publicParts = parts.slice(glowzaIndex >= 0 ? glowzaIndex : parts[0]?.startsWith('v') ? 1 : 0);
    return decodeURIComponent(publicParts.join('/').replace(/\.[a-z0-9]+$/i, ''));
  } catch {
    return '';
  }
}

function isMissingCloudinaryUrl(url: string, existingPublicIds: Set<string>) {
  if (!String(url || '').includes('res.cloudinary.com')) return false;
  const publicId = cloudinaryPublicId(url);
  return Boolean(publicId && !existingPublicIds.has(publicId));
}

function cleanMediaList(values: string[] | undefined, existingPublicIds: Set<string>) {
  return Array.from(
    new Set((values || []).map((value) => value.trim()).filter((value) => value && !isMissingCloudinaryUrl(value, existingPublicIds))),
  );
}

export async function cleanMissingMediaReferences(existingPublicIds: Set<string>) {
  const [products, categories, banners] = await Promise.all([
    listProducts(),
    listCategories(),
    listBanners(),
  ]);
  const batch = writeBatch(db);
  let cleanedProducts = 0;
  let cleanedCategories = 0;
  let cleanedBanners = 0;
  let removedRefs = 0;

  products.forEach((product) => {
    const currentImages = Array.from(new Set([product.image, ...(product.images || [])].filter(Boolean)));
    const currentVideos = product.videos || [];
    const nextImages = cleanMediaList(currentImages, existingPublicIds);
    const nextVideos = cleanMediaList(currentVideos, existingPublicIds);
    const nextImage = !isMissingCloudinaryUrl(product.image || '', existingPublicIds)
      ? product.image || nextImages[0] || ''
      : nextImages[0] || '';
    const removed = currentImages.length + currentVideos.length - nextImages.length - nextVideos.length;

    if (removed > 0 || nextImage !== (product.image || '')) {
      batch.update(doc(db, paths.products, product.id), {
        image: nextImage,
        images: nextImages,
        videos: nextVideos,
        updatedAt: serverTimestamp(),
      });
      cleanedProducts += 1;
      removedRefs += Math.max(0, removed);
    }
  });

  categories.forEach((category) => {
    if (isMissingCloudinaryUrl(category.image || '', existingPublicIds)) {
      batch.update(doc(db, paths.categories, category.id), {
        image: '',
        updatedAt: serverTimestamp(),
      });
      cleanedCategories += 1;
      removedRefs += 1;
    }
  });

  banners.forEach((banner) => {
    if (isMissingCloudinaryUrl(banner.image || '', existingPublicIds)) {
      batch.update(doc(db, paths.banners, banner.id), {
        image: '',
        updatedAt: serverTimestamp(),
      });
      cleanedBanners += 1;
      removedRefs += 1;
    }
  });

  if (cleanedProducts || cleanedCategories || cleanedBanners) {
    await batch.commit();
  }

  return { cleanedProducts, cleanedCategories, cleanedBanners, removedRefs };
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
  const videos = (input.videos || [])
    .map((video) => video.trim())
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
    videos,
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
    source: input.source || '',
    sourceUrl: input.sourceUrl || '',
    markazPrice: Number(input.markazPrice) || 0,
    markupPercent: Number(input.markupPercent) || 0,
    cutPriceMarkupPercent: Number(input.cutPriceMarkupPercent) || 0,
    winningScore: Number(input.winningScore) || 0,
    importStatus: input.importStatus || '',
    needsReview: Boolean(input.needsReview),
    markazStatus: input.markazStatus || '',
    markazVariationId: input.markazVariationId || '',
    markazVariationName: input.markazVariationName || '',
    sourceSyncedAt: input.sourceSyncedAt || null,
    sourceImages: input.sourceImages || [],
    sourceVideos: input.sourceVideos || [],
    syncChangeSummary: input.syncChangeSummary || [],
    syncChangeCount: Number(input.syncChangeCount) || 0,
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

export async function bulkUpdateProducts(
  ids: string[],
  patch: Partial<Pick<Product, 'isActive' | 'needsReview' | 'isNew' | 'isBestSeller' | 'isFlashSale'>>,
) {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.update(doc(db, paths.products, id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function bulkDeleteProducts(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, paths.products, id)));
  await batch.commit();
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

export async function updateUserProfile(id: string, input: Partial<Pick<User, 'name' | 'role' | 'isBlocked'>>) {
  await updateDoc(doc(db, paths.users, id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
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
