import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/banner.dart';
import '../models/category.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../models/review.dart';
import '../models/user_profile.dart';
import '../services/firestore_paths.dart';

class FirestoreRepository {
  FirestoreRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _users =>
      _firestore.collection(FirestorePaths.users);
  CollectionReference<Map<String, dynamic>> get _categories =>
      _firestore.collection(FirestorePaths.categories);
  CollectionReference<Map<String, dynamic>> get _banners =>
      _firestore.collection(FirestorePaths.banners);
  CollectionReference<Map<String, dynamic>> get _products =>
      _firestore.collection(FirestorePaths.products);
  CollectionReference<Map<String, dynamic>> get _orders =>
      _firestore.collection(FirestorePaths.orders);
  CollectionReference<Map<String, dynamic>> get _reviews =>
      _firestore.collection(FirestorePaths.reviews);
  CollectionReference<Map<String, dynamic>> get _deviceTokens =>
      _firestore.collection(FirestorePaths.deviceTokens);

  Future<UserProfile> loginOrCreateUser({
    required String name,
    required String phone,
  }) async {
    final existing = await _users
        .where('phone', isEqualTo: phone)
        .limit(1)
        .get();

    if (existing.docs.isNotEmpty) {
      final user = UserProfile.fromFirestore(existing.docs.first);
      await existing.docs.first.reference.update({
        'name': name.trim().isEmpty ? user.fullName : name.trim(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return UserProfile(
        id: user.id,
        fullName: name.trim().isEmpty ? user.fullName : name.trim(),
        mobileNumber: user.mobileNumber,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: DateTime.now(),
      );
    }

    final doc = _users.doc();
    final user = UserProfile(
      id: doc.id,
      fullName: name.trim(),
      mobileNumber: phone,
    );
    await doc.set(user.toFirestore(includeCreatedAt: true));
    return user;
  }

  Future<List<Category>> fetchActiveCategories() async {
    final snapshot = await _categories.where('isActive', isEqualTo: true).get();
    final categories = snapshot.docs.map(Category.fromFirestore).toList();
    categories.sort((a, b) => a.name.compareTo(b.name));
    return categories;
  }

  Future<List<Product>> fetchActiveProducts() async {
    final categories = await fetchActiveCategories();
    final categoryNamesById = {
      for (final category in categories) category.id: category.name,
    };
    final snapshot = await _products.where('isActive', isEqualTo: true).get();
    return snapshot.docs
        .map(
          (doc) => Product.fromFirestore(
            doc,
            categoryName: categoryNamesById[doc.data()['categoryId']] ?? '',
          ),
        )
        .toList();
  }

  Future<ProductPageResult> fetchActiveProductsPage({
    int limit = 20,
    DocumentSnapshot<Map<String, dynamic>>? startAfter,
  }) async {
    final categories = await fetchActiveCategories();
    final categoryNamesById = {
      for (final category in categories) category.id: category.name,
    };
    Query<Map<String, dynamic>> query = _products
        .where('isActive', isEqualTo: true)
        .limit(limit);
    if (startAfter != null) {
      query = query.startAfterDocument(startAfter);
    }
    final snapshot = await query.get();
    final products =
        snapshot.docs
            .map(
              (doc) => Product.fromFirestore(
                doc,
                categoryName: categoryNamesById[doc.data()['categoryId']] ?? '',
              ),
            )
            .toList()
          ..sort((a, b) {
            final aDate = a.createdAt;
            final bDate = b.createdAt;
            if (aDate == null && bDate == null) {
              return a.name.compareTo(b.name);
            }
            if (aDate == null) {
              return 1;
            }
            if (bDate == null) {
              return -1;
            }
            return bDate.compareTo(aDate);
          });
    return ProductPageResult(
      products: products,
      lastDocument: snapshot.docs.isEmpty ? null : snapshot.docs.last,
      hasMore: snapshot.docs.length == limit,
    );
  }

  Future<List<AppBanner>> fetchActiveBanners() async {
    final snapshot = await _banners.where('isActive', isEqualTo: true).get();
    final banners = snapshot.docs.map(AppBanner.fromFirestore).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return banners;
  }

  Future<String> createOrder(GlowzaOrder order) async {
    final doc = _orders.doc();
    await doc.set(order.toFirestore(includeCreatedAt: true));
    return doc.id;
  }

  Future<List<GlowzaOrder>> fetchOrdersForUser(String userId) async {
    if (userId.isEmpty) {
      return [];
    }
    final snapshot = await _orders.where('userId', isEqualTo: userId).get();
    final orders = snapshot.docs.map(GlowzaOrder.fromFirestore).toList()
      ..sort((a, b) {
        final aDate = a.createdAt;
        final bDate = b.createdAt;
        if (aDate == null && bDate == null) {
          return b.orderNumber.compareTo(a.orderNumber);
        }
        if (aDate == null) {
          return 1;
        }
        if (bDate == null) {
          return -1;
        }
        return bDate.compareTo(aDate);
      });
    return orders;
  }

  Future<bool> hasReviewForOrderProduct({
    required String userId,
    required String orderId,
    required String productId,
  }) async {
    if (userId.isEmpty || orderId.isEmpty || productId.isEmpty) {
      return false;
    }
    final snapshot = await _reviews.where('userId', isEqualTo: userId).get();
    return snapshot.docs.any((doc) {
      final data = doc.data();
      return data['orderId'] == orderId && data['productId'] == productId;
    });
  }

  Future<String> submitPendingReview(Review review) async {
    final doc = _reviews.doc();
    await doc.set(review.toFirestore(includeCreatedAt: true));
    return doc.id;
  }

  Future<void> saveDeviceToken({
    required String userId,
    required String phone,
    required String token,
    required String platform,
  }) async {
    if (token.isEmpty) {
      return;
    }
    await _deviceTokens.doc(token).set({
      'userId': userId,
      'phone': phone,
      'token': token,
      'platform': platform,
      'isActive': true,
      'updatedAt': FieldValue.serverTimestamp(),
      'createdAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<void> upsertCategory(Category category) async {
    final doc = category.id.isEmpty
        ? _categories.doc()
        : _categories.doc(category.id);
    await doc.set(category.toFirestore(includeCreatedAt: category.id.isEmpty));
  }

  Future<void> upsertProduct(Product product) async {
    final doc = product.id.isEmpty
        ? _products.doc()
        : _products.doc(product.id);
    await doc.set(product.toFirestore(includeCreatedAt: product.id.isEmpty));
  }
}

class ProductPageResult {
  const ProductPageResult({
    required this.products,
    required this.lastDocument,
    required this.hasMore,
  });

  final List<Product> products;
  final DocumentSnapshot<Map<String, dynamic>>? lastDocument;
  final bool hasMore;
}
