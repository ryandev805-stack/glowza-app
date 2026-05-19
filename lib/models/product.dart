import 'package:cloud_firestore/cloud_firestore.dart';

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.brand,
    required this.category,
    this.categoryId = '',
    required this.productType,
    required this.skinType,
    required this.price,
    required this.oldPrice,
    required this.discountPercent,
    required this.rating,
    required this.reviewCount,
    required this.description,
    required this.ingredients,
    required this.howToUse,
    required this.imageUrl,
    this.images = const [],
    this.reviews = const [],
    this.stock = 0,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
    this.inStock = true,
    this.isNew = false,
    this.isBestSeller = false,
    this.isFlashSale = false,
  });

  final String id;
  final String name;
  final String brand;
  final String category;
  final String categoryId;
  final String productType;
  final String skinType;
  final int price;
  final int oldPrice;
  final int discountPercent;
  final double rating;
  final int reviewCount;
  final String description;
  final String ingredients;
  final String howToUse;
  final String imageUrl;
  final List<String> images;
  final List<ProductReview> reviews;
  final int stock;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final bool inStock;
  final bool isNew;
  final bool isBestSeller;
  final bool isFlashSale;

  factory Product.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc, {
    String categoryName = '',
  }) {
    final data = doc.data() ?? {};
    final price = (data['price'] as num?)?.round() ?? 0;
    final stock = (data['stock'] as num?)?.round() ?? 0;
    final images = (data['images'] as List<dynamic>? ?? [])
        .whereType<String>()
        .toList();
    final imageUrl =
        data['image'] as String? ?? (images.isNotEmpty ? images.first : '');
    return Product(
      id: doc.id,
      name: data['name'] as String? ?? '',
      brand: data['brand'] as String? ?? 'Glowza',
      category: categoryName,
      categoryId: data['categoryId'] as String? ?? '',
      productType: data['productType'] as String? ?? '',
      skinType: data['skinType'] as String? ?? 'All',
      price: price,
      oldPrice: (data['oldPrice'] as num?)?.round() ?? price,
      discountPercent: (data['discount'] as num?)?.round() ?? 0,
      rating: (data['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (data['reviewCount'] as num?)?.round() ?? 0,
      description: data['description'] as String? ?? '',
      ingredients: data['ingredients'] as String? ?? '',
      howToUse: data['howToUse'] as String? ?? '',
      imageUrl: imageUrl,
      images: images.isEmpty && imageUrl.isNotEmpty ? [imageUrl] : images,
      reviews: (data['reviews'] as List<dynamic>? ?? [])
          .whereType<Map>()
          .map(
            (review) =>
                ProductReview.fromMap(Map<String, dynamic>.from(review)),
          )
          .toList(),
      stock: stock,
      isActive: data['isActive'] as bool? ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
      inStock: stock > 0,
      isNew: data['isNew'] as bool? ?? false,
      isBestSeller: data['isBestSeller'] as bool? ?? false,
      isFlashSale: data['isFlashSale'] as bool? ?? false,
    );
  }

  Map<String, Object?> toFirestore({bool includeCreatedAt = false}) {
    return {
      'name': name,
      'description': description,
      'price': price,
      'categoryId': categoryId,
      'image': imageUrl,
      'images': images.isEmpty ? [imageUrl] : images,
      'stock': stock,
      'isActive': isActive,
      if (includeCreatedAt) 'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'brand': brand,
      'productType': productType,
      'skinType': skinType,
      'oldPrice': oldPrice,
      'discount': discountPercent,
      'rating': rating,
      'reviewCount': reviewCount,
      'reviews': reviews.map((review) => review.toMap()).toList(),
      'ingredients': ingredients,
      'howToUse': howToUse,
      'isNew': isNew,
      'isBestSeller': isBestSeller,
      'isFlashSale': isFlashSale,
    };
  }
}

class ProductReview {
  const ProductReview({
    required this.customerName,
    required this.rating,
    required this.comment,
    this.createdAt,
  });

  final String customerName;
  final double rating;
  final String comment;
  final String? createdAt;

  factory ProductReview.fromMap(Map<String, dynamic> map) {
    return ProductReview(
      customerName: map['customerName'] as String? ?? '',
      rating: (map['rating'] as num?)?.toDouble() ?? 0,
      comment: map['comment'] as String? ?? '',
      createdAt: map['createdAt'] as String?,
    );
  }

  Map<String, Object?> toMap() {
    return {
      'customerName': customerName,
      'rating': rating,
      'comment': comment,
      'createdAt': createdAt,
    };
  }
}
