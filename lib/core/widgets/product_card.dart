import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/product.dart';
import '../../providers/app_state.dart';
import '../theme/app_theme.dart';
import 'price_text.dart';
import 'product_image.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final isWishlisted = appState.isWishlisted(product.id);

    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => context.push('/product/${product.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppTheme.blush),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 170,
              width: double.infinity,
              child: ProductImage(imageUrl: product.imageUrl),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Text(
                  //   product.brand,
                  //   maxLines: 1,
                  //   overflow: TextOverflow.ellipsis,
                  //   style: const TextStyle(
                  //     color: AppTheme.wine,
                  //     fontWeight: FontWeight.w500,
                  //     fontSize: 11,
                  //   ),
                  // ),
                  Row(
                    children: [
                      Expanded(
                        child: PriceText(price: product.price, large: true),
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints.tightFor(
                          width: 34,
                          height: 34,
                        ),
                        onPressed: () => appState.toggleWishlist(product.id),
                        icon: Icon(
                          isWishlisted ? Icons.favorite : Icons.favorite_border,
                          color: isWishlisted
                              ? AppTheme.primary
                              : AppTheme.wine,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      height: 1.08,
                      color: AppTheme.plum,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        color: AppTheme.gold,
                        size: 16,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        '${product.rating}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.plum,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${product.discountPercent}% off',
                        style: const TextStyle(
                          color: AppTheme.wine,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  // const SizedBox(height: 7),
                  // SizedBox(
                  //   width: double.infinity,
                  //   height: 34,
                  //   child: ElevatedButton.icon(
                  //     style: ElevatedButton.styleFrom(
                  //       minimumSize: const Size.fromHeight(34),
                  //       padding: const EdgeInsets.symmetric(horizontal: 8),
                  //       textStyle: const TextStyle(
                  //         fontWeight: FontWeight.w600,
                  //         fontSize: 12,
                  //       ),
                  //     ),
                  //     onPressed: () => appState.addToCart(product),
                  //     icon: const Icon(Icons.shopping_bag_outlined, size: 16),
                  //     label: const Text('Add'),
                  //   ),
                  // ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
