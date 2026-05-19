class OrderProduct {
  const OrderProduct({
    required this.productId,
    required this.name,
    required this.price,
    required this.quantity,
    required this.image,
  });

  final String productId;
  final String name;
  final int price;
  final int quantity;
  final String image;

  Map<String, Object?> toMap() {
    return {
      'productId': productId,
      'name': name,
      'price': price,
      'quantity': quantity,
      'image': image,
    };
  }

  factory OrderProduct.fromMap(Map<String, dynamic> map) {
    return OrderProduct(
      productId: map['productId'] as String? ?? '',
      name: map['name'] as String? ?? '',
      price: (map['price'] as num?)?.round() ?? 0,
      quantity: (map['quantity'] as num?)?.round() ?? 0,
      image: map['image'] as String? ?? '',
    );
  }
}
