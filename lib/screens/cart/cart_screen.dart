import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/empty_state.dart';
import '../../core/widgets/price_text.dart';
import '../../core/widgets/product_image.dart';
import '../../providers/app_state.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: appState.cart.isEmpty
          ? const EmptyState(
              icon: Icons.shopping_bag_outlined,
              title: 'Your cart is empty',
              message:
                  'Add cosmetics you love and checkout with cash on delivery.',
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                ...appState.cart.map(
                  (item) => Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: const Color(0xFFFFE4EF)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(
                            0xFFC2185B,
                          ).withValues(alpha: 0.08),
                          blurRadius: 24,
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 86,
                          height: 96,
                          child: ProductImage(imageUrl: item.product.imageUrl),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.product.brand,
                                style: TextStyle(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.secondary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                              Text(
                                item.product.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 8),
                              PriceText(price: item.product.price),
                              Row(
                                children: [
                                  IconButton(
                                    onPressed: () => appState.updateQuantity(
                                      item.product.id,
                                      item.quantity - 1,
                                    ),
                                    icon: const Icon(
                                      Icons.remove_circle_outline,
                                    ),
                                  ),
                                  Text(
                                    '${item.quantity}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () => appState.updateQuantity(
                                      item.product.id,
                                      item.quantity + 1,
                                    ),
                                    icon: const Icon(Icons.add_circle_outline),
                                  ),
                                  const Spacer(),
                                  IconButton(
                                    onPressed: () => appState.removeFromCart(
                                      item.product.id,
                                    ),
                                    icon: const Icon(Icons.delete_outline),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Coupon code',
                    prefixIcon: Icon(Icons.local_offer_outlined),
                  ),
                ),
                const SizedBox(height: 18),
                _TotalRow(label: 'Subtotal', value: appState.subtotal),
                _TotalRow(
                  label: 'Delivery charges',
                  value: appState.deliveryCharges,
                ),
                const Divider(height: 28),
                _TotalRow(
                  label: 'Grand total',
                  value: appState.grandTotal,
                  strong: true,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => context.push('/checkout'),
                  child: const Text('Checkout'),
                ),
              ],
            ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.strong = false,
  });

  final String label;
  final int value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontWeight: strong ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ),
          Text(
            'PKR $value',
            style: TextStyle(
              fontWeight: strong ? FontWeight.w700 : FontWeight.w400,
              fontSize: strong ? 18 : 15,
            ),
          ),
        ],
      ),
    );
  }
}
