import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/app_constants.dart';
import '../models/banner.dart';
import '../models/cart_item.dart';
import '../models/category.dart';
import '../models/checkout_info.dart';
import '../models/game_reward_signal.dart';
import '../models/order.dart';
import '../models/order_product.dart';
import '../models/product.dart';
import '../models/review.dart';
import '../models/user_profile.dart';
import '../repositories/firestore_repository.dart';
import '../services/notification_service.dart';
import '../services/review_api_service.dart';

class AppState extends ChangeNotifier {
  AppState({
    FirestoreRepository? repository,
    NotificationService? notificationService,
    ReviewApiService? reviewApiService,
  }) : _repository = repository ?? FirestoreRepository(),
       _notificationService = notificationService ?? NotificationService(),
       _reviewApiService = reviewApiService ?? const ReviewApiService();

  static const _userKey = 'glowza_user';
  static const _checkoutKey = 'glowza_checkout';
  static const _gameWalletKey = 'glowza_game_wallet';
  static const _gameWalletDateKey = 'glowza_game_wallet_date';

  final FirestoreRepository _repository;
  final NotificationService _notificationService;
  final ReviewApiService _reviewApiService;

  UserProfile? _user;
  CheckoutInfo _savedCheckout = CheckoutInfo.empty();
  final List<CartItem> _cart = [];
  final Set<String> _wishlist = {};
  List<GlowzaOrder> _orders = [];
  List<Category> _categories = [];
  List<Product> _products = [];
  List<AppBanner> _banners = [];
  DocumentSnapshot<Map<String, dynamic>>? _lastProductDocument;
  bool _hasMoreProducts = true;
  bool _isLoadingMoreProducts = false;
  String? _lastOrderId;
  bool _isBusy = false;
  int _gamePoints = 0;
  int _gamePointsEarnedToday = 0;

  UserProfile? get user => _user;
  CheckoutInfo get savedCheckout => _savedCheckout;
  List<CartItem> get cart => List.unmodifiable(_cart);
  Set<String> get wishlist => Set.unmodifiable(_wishlist);
  List<GlowzaOrder> get orders => List.unmodifiable(_orders);
  List<Category> get categories => List.unmodifiable(_categories);
  List<Product> get products => List.unmodifiable(_products);
  List<AppBanner> get banners => List.unmodifiable(_banners);
  bool get hasMoreProducts => _hasMoreProducts;
  bool get isLoadingMoreProducts => _isLoadingMoreProducts;
  String? get lastOrderId => _lastOrderId;
  bool get isBusy => _isBusy;
  bool get isLoggedIn => _user != null;
  int get cartCount => _cart.fold(0, (total, item) => total + item.quantity);
  int get subtotal => _cart.fold(0, (total, item) => total + item.lineTotal);
  int get shippingFee => _cart.isEmpty ? 0 : AppConstants.shippingFee;
  int get taxFee => _cart.isEmpty ? 0 : AppConstants.taxFee;
  int get codHandlingFee => _cart.isEmpty ? 0 : AppConstants.codHandlingFee;
  int get deliveryCharges => shippingFee + taxFee + codHandlingFee;
  int get grandTotal => subtotal + deliveryCharges;
  int get gamePoints => _gamePoints;
  int get gamePointsEarnedToday => _gamePointsEarnedToday;
  int get gameDiscountValue {
    if (subtotal < AppConstants.gameRewardMinimumOrder) {
      return 0;
    }
    final pointsValue = _gamePoints ~/ AppConstants.gamePointsPerRupee;
    final orderCap = (subtotal * AppConstants.gameRewardMaxOrderPercent)
        .floor();
    return [
      pointsValue,
      AppConstants.gameRewardMaxDiscount,
      orderCap,
    ].reduce((a, b) => a < b ? a : b);
  }

  bool get canUseGameDiscount => gameDiscountValue > 0;

  Future<void> loadSavedState() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_userKey);
    final checkoutJson = prefs.getString(_checkoutKey);
    if (userJson != null) {
      _user = UserProfile.fromJson(
        jsonDecode(userJson) as Map<String, dynamic>,
      );
      if (_user != null &&
          _user!.id.isEmpty &&
          _user!.mobileNumber.isNotEmpty) {
        _user = await _repository.loginOrCreateUser(
          name: _user!.fullName,
          phone: _user!.mobileNumber,
        );
        await prefs.setString(_userKey, jsonEncode(_user!.toJson()));
      }
    }
    if (checkoutJson != null) {
      _savedCheckout = CheckoutInfo.fromJson(
        jsonDecode(checkoutJson) as Map<String, dynamic>,
      );
    }
    await _loadGameWallet(prefs);
    await loadCatalog();
    await loadUserOrders();
    await registerDeviceForNotifications();
  }

  Future<void> loadCatalog() async {
    try {
      final firestoreCategories = await _repository.fetchActiveCategories();
      final productPage = await _repository.fetchActiveProductsPage();
      final firestoreBanners = await _repository.fetchActiveBanners();
      _categories = firestoreCategories;
      _products = productPage.products;
      _lastProductDocument = productPage.lastDocument;
      _hasMoreProducts = productPage.hasMore;
      _banners = firestoreBanners;
      notifyListeners();
    } catch (error, stackTrace) {
      debugPrint('Glowza Firestore catalog load failed: $error');
      debugPrintStack(stackTrace: stackTrace);
      _categories = [];
      _products = [];
      _banners = [];
      _lastProductDocument = null;
      _hasMoreProducts = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreProducts() async {
    if (!_hasMoreProducts || _isLoadingMoreProducts) {
      return;
    }
    _isLoadingMoreProducts = true;
    notifyListeners();
    try {
      final page = await _repository.fetchActiveProductsPage(
        startAfter: _lastProductDocument,
      );
      final existingIds = _products.map((product) => product.id).toSet();
      _products = [
        ..._products,
        ...page.products.where((product) => !existingIds.contains(product.id)),
      ];
      _lastProductDocument = page.lastDocument ?? _lastProductDocument;
      _hasMoreProducts = page.hasMore;
    } finally {
      _isLoadingMoreProducts = false;
      notifyListeners();
    }
  }

  Future<void> login(String fullName, String mobileNumber) async {
    _setBusy(true);
    try {
      final user = await _repository.loginOrCreateUser(
        name: fullName.trim(),
        phone: mobileNumber,
      );
      _user = user;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userKey, jsonEncode(user.toJson()));
      await loadUserOrders();
      await registerDeviceForNotifications();
      notifyListeners();
    } finally {
      _setBusy(false);
    }
  }

  Future<void> logout() async {
    _user = null;
    _cart.clear();
    _wishlist.clear();
    _orders = [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    notifyListeners();
  }

  Future<void> grantGameReward(GameRewardSignal signal) async {
    if (signal.rewardedAdsCompleted <= 0 ||
        signal.durationSeconds < AppConstants.gameRewardMinimumSessionSeconds) {
      return;
    }
    final timeQualifiedAds =
        signal.durationSeconds ~/ AppConstants.gameRewardSecondsPerCreditedAd;
    final creditedAds = signal.rewardedAdsCompleted.clamp(0, timeQualifiedAds);
    if (creditedAds <= 0) {
      return;
    }
    final estimatedRevenuePkr =
        creditedAds * AppConstants.gameEstimatedRewardedAdRevenuePkr;
    final userRewardValuePkr =
        estimatedRevenuePkr * AppConstants.gameUserRewardShare;
    final rawPoints = (userRewardValuePkr * AppConstants.gamePointsPerRupee)
        .round();
    final remainingDailyCap =
        AppConstants.gameRewardDailyPointCap - _gamePointsEarnedToday;
    if (remainingDailyCap <= 0) {
      return;
    }
    final granted = rawPoints.clamp(0, remainingDailyCap).toInt();
    if (granted == 0) {
      return;
    }
    _gamePoints += granted;
    _gamePointsEarnedToday += granted;
    await _saveGameWallet();
    notifyListeners();
  }

  Future<void> spendGamePointsForDiscount(int discountValue) async {
    if (discountValue <= 0) {
      return;
    }
    final points = discountValue * AppConstants.gamePointsPerRupee;
    _gamePoints = (_gamePoints - points).clamp(0, 1 << 31).toInt();
    await _saveGameWallet();
    notifyListeners();
  }

  void addToCart(Product product, {int quantity = 1}) {
    final index = _cart.indexWhere((item) => item.product.id == product.id);
    if (index == -1) {
      _cart.add(CartItem(product: product, quantity: quantity));
    } else {
      _cart[index] = _cart[index].copyWith(
        quantity: _cart[index].quantity + quantity,
      );
    }
    notifyListeners();
  }

  void updateQuantity(String productId, int quantity) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    final index = _cart.indexWhere((item) => item.product.id == productId);
    if (index != -1) {
      _cart[index] = _cart[index].copyWith(quantity: quantity);
      notifyListeners();
    }
  }

  void removeFromCart(String productId) {
    _cart.removeWhere((item) => item.product.id == productId);
    notifyListeners();
  }

  bool isWishlisted(String productId) => _wishlist.contains(productId);

  void toggleWishlist(String productId) {
    if (_wishlist.contains(productId)) {
      _wishlist.remove(productId);
    } else {
      _wishlist.add(productId);
    }
    notifyListeners();
  }

  Future<void> saveCheckoutInfo(CheckoutInfo info) async {
    _savedCheckout = info;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_checkoutKey, jsonEncode(info.toJson()));
    notifyListeners();
  }

  Future<void> loadUserOrders() async {
    final currentUser = _user;
    if (currentUser == null) {
      _orders = [];
      notifyListeners();
      return;
    }
    try {
      _orders = await _repository.fetchOrdersForUser(currentUser.id);
      notifyListeners();
    } catch (error, stackTrace) {
      debugPrint('Glowza user orders load failed: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
  }

  GlowzaOrder? deliveredOrderForProduct(String productId) {
    final currentUser = _user;
    if (currentUser == null) {
      return null;
    }
    for (final order in _orders) {
      final isDelivered = order.status.toLowerCase() == 'delivered';
      final belongsToUser = order.userId == currentUser.id;
      final hasProduct = order.products.any(
        (product) => product.productId == productId,
      );
      if (isDelivered && belongsToUser && hasProduct) {
        return order;
      }
    }
    return null;
  }

  Future<bool> hasReviewedProductFromOrder({
    required String productId,
    required String orderId,
  }) async {
    final currentUser = _user;
    if (currentUser == null) {
      return false;
    }
    return _repository.hasReviewForOrderProduct(
      userId: currentUser.id,
      orderId: orderId,
      productId: productId,
    );
  }

  Future<void> submitProductReview({
    required Product product,
    required GlowzaOrder order,
    required double rating,
    required String comment,
  }) async {
    final currentUser = _user;
    if (currentUser == null) {
      throw StateError('Login is required to submit a review.');
    }
    if (order.status.toLowerCase() != 'delivered') {
      throw StateError('Review is available after delivery.');
    }
    final alreadyReviewed = await _repository.hasReviewForOrderProduct(
      userId: currentUser.id,
      orderId: order.id,
      productId: product.id,
    );
    if (alreadyReviewed) {
      throw StateError('You have already reviewed this delivered item.');
    }
    if (_reviewApiService.isConfigured) {
      await _reviewApiService.submitReview(
        userId: currentUser.id,
        productId: product.id,
        orderId: order.id,
        rating: rating,
        comment: comment.trim(),
        customerName: currentUser.fullName,
      );
      return;
    }

    await _repository.submitPendingReview(
      Review(
        id: '',
        userId: currentUser.id,
        productId: product.id,
        orderId: order.id,
        rating: rating,
        comment: comment.trim(),
        customerName: currentUser.fullName,
        status: 'pending',
      ),
    );
  }

  Future<void> registerDeviceForNotifications() async {
    final currentUser = _user;
    if (currentUser == null) {
      return;
    }
    try {
      final token = await _notificationService.requestAndGetToken();
      if (token == null || token.isEmpty) {
        return;
      }
      await _repository.saveDeviceToken(
        userId: currentUser.id,
        phone: currentUser.mobileNumber,
        token: token,
        platform: _notificationService.platform,
      );
    } catch (error, stackTrace) {
      debugPrint('Glowza notification token registration failed: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
  }

  Future<void> placeOrder({
    required CheckoutInfo checkoutInfo,
    int gameDiscount = 0,
  }) async {
    final currentUser = _user;
    if (currentUser == null || _cart.isEmpty) {
      return;
    }

    _setBusy(true);
    try {
      final orderNumber =
          'GLZ-${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}';
      final safeGameDiscount = gameDiscount.clamp(0, gameDiscountValue).toInt();
      final order = GlowzaOrder(
        id: '',
        userId: currentUser.id,
        orderNumber: orderNumber,
        status: 'pending',
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'unpaid',
        subtotal: subtotal,
        shippingFee: shippingFee,
        taxFee: taxFee,
        codHandlingFee: codHandlingFee,
        discount: safeGameDiscount,
        total: grandTotal - safeGameDiscount,
        totalItems: cartCount,
        customerName: checkoutInfo.fullName,
        customerPhone: checkoutInfo.phoneNumber,
        city: checkoutInfo.city,
        address: checkoutInfo.fullAddress,
        notes: checkoutInfo.area,
        nearbyPlace: checkoutInfo.nearbyPlace,
        products: _cart
            .map(
              (item) => OrderProduct(
                productId: item.product.id,
                name: item.product.name,
                price: item.product.price,
                quantity: item.quantity,
                image: item.product.imageUrl,
              ),
            )
            .toList(),
      );
      await _repository.createOrder(order);
      if (safeGameDiscount > 0) {
        await spendGamePointsForDiscount(safeGameDiscount);
      }
      _lastOrderId = orderNumber;
      _orders = [order, ..._orders];
      _cart.clear();
      notifyListeners();
    } finally {
      _setBusy(false);
    }
  }

  void _setBusy(bool value) {
    _isBusy = value;
    notifyListeners();
  }

  Future<void> _loadGameWallet(SharedPreferences prefs) async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final walletDate = prefs.getString(_gameWalletDateKey);
    _gamePoints = prefs.getInt(_gameWalletKey) ?? 0;
    if (walletDate == today) {
      _gamePointsEarnedToday = prefs.getInt('${_gameWalletKey}_today') ?? 0;
    } else {
      _gamePointsEarnedToday = 0;
      await prefs.setString(_gameWalletDateKey, today);
      await prefs.setInt('${_gameWalletKey}_today', 0);
    }
  }

  Future<void> _saveGameWallet() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    await prefs.setInt(_gameWalletKey, _gamePoints);
    await prefs.setString(_gameWalletDateKey, today);
    await prefs.setInt('${_gameWalletKey}_today', _gamePointsEarnedToday);
  }
}
