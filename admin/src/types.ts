import type { Timestamp } from 'firebase/firestore';

export type FirestoreDate = Timestamp | Date | null;

export type Category = {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type Banner = {
  id: string;
  title: string;
  image: string;
  link: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  image: string;
  images?: string[];
  videos?: string[];
  stock: number;
  isActive: boolean;
  brand?: string;
  productType?: string;
  skinType?: string;
  oldPrice?: number;
  discount?: number;
  rating?: number;
  reviewCount?: number;
  ingredients?: string;
  howToUse?: string;
  isNew?: boolean;
  isBestSeller?: boolean;
  isFlashSale?: boolean;
  source?: string;
  sourceUrl?: string;
  markazPrice?: number;
  markupPercent?: number;
  cutPriceMarkupPercent?: number;
  winningScore?: number;
  importStatus?: 'draft' | 'imported' | 'rejected';
  needsReview?: boolean;
  markazStatus?: string;
  markazVariationId?: string;
  markazVariationName?: string;
  sourceSyncedAt?: FirestoreDate;
  sourceImages?: string[];
  sourceVideos?: string[];
  syncChangeSummary?: string[];
  syncChangeCount?: number;
  reviews?: ProductReview[];
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type WinningProductCandidate = {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  markazPrice: number;
  price: number;
  oldPrice: number;
  discount: number;
  image: string;
  images: string[];
  videos: string[];
  markazVariationId?: string;
  markazVariationName?: string;
  brand: string;
  stock: number;
  markazStatus?: string;
  winningScore: number;
  reasons: string[];
  duplicate: boolean;
};

export type ProductReview = {
  customerName: string;
  rating: number;
  comment: string;
  createdAt?: string;
};

export type Review = ProductReview & {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  status: 'pending' | 'approved' | 'hidden';
  updatedAt?: FirestoreDate;
};

export type DeviceToken = {
  id: string;
  userId: string;
  phone: string;
  token: string;
  platform: string;
  isActive: boolean;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  image: string;
  targetType: 'all' | 'platform' | 'user';
  targetValue: string;
  status: 'draft' | 'sent' | 'failed';
  sentCount: number;
  createdAt?: FirestoreDate;
  sentAt?: FirestoreDate;
};

export type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  isBlocked?: boolean;
  defaultAddress?: string;
  city?: string;
  area?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type OrderProduct = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
};

export type Order = {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  totalItems: number;
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  notes: string;
  products: OrderProduct[];
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};
