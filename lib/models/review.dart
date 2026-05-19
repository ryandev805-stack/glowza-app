import 'package:cloud_firestore/cloud_firestore.dart';

class Review {
  const Review({
    required this.id,
    required this.userId,
    required this.productId,
    required this.orderId,
    required this.rating,
    required this.comment,
    required this.customerName,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String productId;
  final String orderId;
  final double rating;
  final String comment;
  final String customerName;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory Review.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Review(
      id: doc.id,
      userId: data['userId'] as String? ?? '',
      productId: data['productId'] as String? ?? '',
      orderId: data['orderId'] as String? ?? '',
      rating: (data['rating'] as num?)?.toDouble() ?? 0,
      comment: data['comment'] as String? ?? '',
      customerName: data['customerName'] as String? ?? '',
      status: data['status'] as String? ?? 'pending',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, Object?> toFirestore({bool includeCreatedAt = false}) {
    return {
      'userId': userId,
      'productId': productId,
      'orderId': orderId,
      'rating': rating,
      'comment': comment,
      'customerName': customerName,
      'status': status,
      if (includeCreatedAt) 'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}
