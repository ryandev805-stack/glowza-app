import 'package:cloud_firestore/cloud_firestore.dart';

import 'order_product.dart';

typedef Order = GlowzaOrder;

class GlowzaOrder {
  const GlowzaOrder({
    required this.id,
    required this.userId,
    required this.orderNumber,
    required this.status,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.subtotal,
    required this.shippingFee,
    required this.taxFee,
    required this.codHandlingFee,
    required this.discount,
    required this.total,
    required this.totalItems,
    required this.customerName,
    required this.customerPhone,
    required this.city,
    required this.address,
    required this.notes,
    required this.nearbyPlace,
    required this.products,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String orderNumber;
  final String status;
  final String paymentMethod;
  final String paymentStatus;
  final int subtotal;
  final int shippingFee;
  final int taxFee;
  final int codHandlingFee;
  final int discount;
  final int total;
  final int totalItems;
  final String customerName;
  final String customerPhone;
  final String city;
  final String address;
  final String notes;
  final String nearbyPlace;
  final List<OrderProduct> products;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory GlowzaOrder.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? {};
    final rawProducts = data['products'] as List<dynamic>? ?? [];
    return GlowzaOrder(
      id: doc.id,
      userId: data['userId'] as String? ?? '',
      orderNumber: data['orderNumber'] as String? ?? '',
      status: data['status'] as String? ?? '',
      paymentMethod: data['paymentMethod'] as String? ?? '',
      paymentStatus: data['paymentStatus'] as String? ?? '',
      subtotal: (data['subtotal'] as num?)?.round() ?? 0,
      shippingFee: (data['shippingFee'] as num?)?.round() ?? 0,
      taxFee: (data['taxFee'] as num?)?.round() ?? 0,
      codHandlingFee: (data['codHandlingFee'] as num?)?.round() ?? 0,
      discount: (data['discount'] as num?)?.round() ?? 0,
      total: (data['total'] as num?)?.round() ?? 0,
      totalItems: (data['totalItems'] as num?)?.round() ?? 0,
      customerName: data['customerName'] as String? ?? '',
      customerPhone: data['customerPhone'] as String? ?? '',
      city: data['city'] as String? ?? '',
      address: data['address'] as String? ?? '',
      notes: data['notes'] as String? ?? '',
      nearbyPlace: data['nearbyPlace'] as String? ?? '',
      products: rawProducts
          .whereType<Map>()
          .map(
            (product) =>
                OrderProduct.fromMap(Map<String, dynamic>.from(product)),
          )
          .toList(),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, Object?> toFirestore({bool includeCreatedAt = false}) {
    return {
      'userId': userId,
      'orderNumber': orderNumber,
      'status': status,
      'paymentMethod': paymentMethod,
      'paymentStatus': paymentStatus,
      'subtotal': subtotal,
      'shippingFee': shippingFee,
      'taxFee': taxFee,
      'codHandlingFee': codHandlingFee,
      'discount': discount,
      'total': total,
      'totalItems': totalItems,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'city': city,
      'address': address,
      'notes': notes,
      'nearbyPlace': nearbyPlace,
      'products': products.map((product) => product.toMap()).toList(),
      if (includeCreatedAt) 'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}
