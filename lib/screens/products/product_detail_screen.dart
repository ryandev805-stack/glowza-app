import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/price_text.dart';
import '../../core/widgets/product_card.dart';
import '../../core/widgets/product_image.dart';
import '../../core/widgets/section_header.dart';
import '../../models/order.dart';
import '../../models/product.dart';
import '../../providers/app_state.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key, required this.product});

  final Product product;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final gallery = product.images.isNotEmpty
        ? product.images
        : [product.imageUrl];
    final related = context
        .watch<AppState>()
        .products
        .where((p) => p.category == product.category && p.id != product.id)
        .take(5)
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: Text(product.brand),
        actions: [
          IconButton(
            onPressed: () =>
                context.read<AppState>().toggleWishlist(product.id),
            icon: Icon(
              context.watch<AppState>().isWishlisted(product.id)
                  ? Icons.favorite
                  : Icons.favorite_border,
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => context.read<AppState>().addToCart(
                  product,
                  quantity: _quantity,
                ),
                child: const Text('Add to Cart'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  context.read<AppState>().addToCart(
                    product,
                    quantity: _quantity,
                  );
                  context.push('/checkout');
                },
                child: const Text('Buy Now'),
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 12),
        children: [
          SizedBox(
            height: 340,
            child: PageView.builder(
              itemCount: gallery.length,
              itemBuilder: (context, index) => Padding(
                padding: const EdgeInsets.all(20),
                child: ProductImage(imageUrl: gallery[index], borderRadius: 28),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Text(
                //   product.brand,
                //   style: const TextStyle(
                //     fontWeight: FontWeight.w500,
                //     color: AppTheme.primary,
                //   ),
                // ),
                // const SizedBox(height: 6),
                Text(
                  product.name,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                PriceText(
                  price: product.price,
                  oldPrice: product.oldPrice,
                  large: true,
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  children: [
                    Chip(label: Text('${product.discountPercent}% discount')),
                    Chip(
                      avatar: const Icon(
                        Icons.star_rounded,
                        color: AppTheme.gold,
                        size: 18,
                      ),
                      label: Text(
                        '${product.rating} (${product.reviewCount} reviews)',
                      ),
                    ),
                    // const Chip(
                    //   avatar: Icon(Icons.payments_outlined, size: 18),
                    //   label: Text('Cash on Delivery Available'),
                    // ),
                  ],
                ),
                const SizedBox(height: 10),
                _QuantitySelector(
                  quantity: _quantity,
                  onChanged: (value) => setState(() => _quantity = value),
                ),
                _InfoBlock(title: 'Description', body: product.description),
                if (product.ingredients.isNotEmpty)
                  _InfoBlock(title: 'Ingredients', body: product.ingredients),
                if (product.howToUse.isNotEmpty)
                  _InfoBlock(title: 'How to use', body: product.howToUse),
                _ReviewsSection(product: product),
              ],
            ),
          ),
          if (related.isNotEmpty) ...[
            const SectionHeader(title: 'Related products'),
            SizedBox(
              height: 270,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: related.length,
                separatorBuilder: (context, index) => const SizedBox(width: 14),
                itemBuilder: (context, index) => SizedBox(
                  width: 150,
                  child: ProductCard(product: related[index]),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuantitySelector extends StatelessWidget {
  const _QuantitySelector({required this.quantity, required this.onChanged});

  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Text('Quantity', style: TextStyle(fontWeight: FontWeight.w600)),
        const Spacer(),
        IconButton.filledTonal(
          onPressed: quantity > 1 ? () => onChanged(quantity - 1) : null,
          icon: const Icon(Icons.remove),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            '$quantity',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
          ),
        ),
        IconButton.filledTonal(
          onPressed: () => onChanged(quantity + 1),
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 17),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: TextStyle(color: Colors.grey.shade700, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _ReviewsSection extends StatelessWidget {
  const _ReviewsSection({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final reviews = product.reviews;
    final appState = context.watch<AppState>();
    final deliveredOrder = appState.deliveredOrderForProduct(product.id);
    final rating = product.rating > 0
        ? product.rating
        : _averageRating(reviews);
    final reviewCount = product.reviewCount > 0
        ? product.reviewCount
        : reviews.length;
    final distribution = _ratingDistribution(reviews);

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Customer Reviews',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppTheme.blush,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      size: 16,
                      color: AppTheme.primary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Verified',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppTheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ReviewEligibilityCard(
            product: product,
            deliveredOrder: deliveredOrder,
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppTheme.blush),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 94,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppTheme.plum, AppTheme.primary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        children: [
                          Text(
                            rating.toStringAsFixed(1),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const _StarRow(
                            rating: 5,
                            size: 14,
                            color: Colors.white,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            reviewCount == 0
                                ? 'No reviews yet'
                                : 'Loved by Glowza customers',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            reviewCount == 0
                                ? 'Customer feedback will appear here after reviews are added.'
                                : '$reviewCount review${reviewCount == 1 ? '' : 's'} for this product',
                            style: TextStyle(
                              color: Colors.grey.shade700,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (reviews.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  ...List.generate(5, (index) {
                    final stars = 5 - index;
                    return _RatingBar(
                      stars: stars,
                      count: distribution[stars] ?? 0,
                      total: reviews.length,
                    );
                  }),
                ],
              ],
            ),
          ),
          if (reviews.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: const [
                _ReviewChip(label: 'Quality checked'),
                _ReviewChip(label: 'Real customer feedback'),
                _ReviewChip(label: 'Beauty community'),
              ],
            ),
            const SizedBox(height: 14),
            ...reviews.map((review) => _ReviewCard(review: review)),
          ],
        ],
      ),
    );
  }
}

class _ReviewEligibilityCard extends StatefulWidget {
  const _ReviewEligibilityCard({
    required this.product,
    required this.deliveredOrder,
  });

  final Product product;
  final GlowzaOrder? deliveredOrder;

  @override
  State<_ReviewEligibilityCard> createState() => _ReviewEligibilityCardState();
}

class _ReviewEligibilityCardState extends State<_ReviewEligibilityCard> {
  bool _checking = false;
  bool _alreadyReviewed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _checkReviewStatus();
  }

  @override
  void didUpdateWidget(covariant _ReviewEligibilityCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.deliveredOrder?.id != widget.deliveredOrder?.id ||
        oldWidget.product.id != widget.product.id) {
      _checkReviewStatus();
    }
  }

  Future<void> _checkReviewStatus() async {
    final order = widget.deliveredOrder;
    if (order == null || _checking) {
      return;
    }
    setState(() => _checking = true);
    final reviewed = await context.read<AppState>().hasReviewedProductFromOrder(
      productId: widget.product.id,
      orderId: order.id,
    );
    if (mounted) {
      setState(() {
        _alreadyReviewed = reviewed;
        _checking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final canReview = widget.deliveredOrder != null && !_alreadyReviewed;
    final title = widget.deliveredOrder == null
        ? 'Review unlocks after delivery'
        : _alreadyReviewed
        ? 'Review already submitted'
        : 'Share your Glowza experience';
    final subtitle = widget.deliveredOrder == null
        ? 'Only customers with a delivered order can review this product.'
        : _alreadyReviewed
        ? 'Thanks. Your review is waiting for admin moderation or already approved.'
        : 'Your order was delivered, so you can review this product.';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: canReview ? const Color(0xFFFFF8EA) : const Color(0xFFFFF7FA),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: canReview ? AppTheme.gold : AppTheme.blush),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: Colors.white,
            child: Icon(
              canReview ? Icons.rate_review_outlined : Icons.lock_outline,
              color: canReview ? AppTheme.gold : AppTheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(color: Colors.grey.shade700, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            onPressed: canReview && !_checking
                ? () => _showWriteReviewSheet(
                    context,
                    product: widget.product,
                    order: widget.deliveredOrder!,
                    onSubmitted: () => setState(() => _alreadyReviewed = true),
                  )
                : null,
            child: Text(_checking ? 'Checking' : 'Write'),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final ProductReview review;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFFFE1EF)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: AppTheme.blush,
                child: Text(
                  _initials(review.customerName),
                  style: const TextStyle(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.customerName.isEmpty
                          ? 'Glowza customer'
                          : review.customerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _StarRow(rating: review.rating, size: 15),
                        const SizedBox(width: 8),
                        Text(
                          review.rating.toStringAsFixed(1),
                          style: const TextStyle(
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (_formatReviewDate(review.createdAt).isNotEmpty)
                Text(
                  _formatReviewDate(review.createdAt),
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
            ],
          ),
          if (review.comment.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              review.comment,
              style: TextStyle(
                color: Colors.grey.shade800,
                height: 1.42,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

Future<void> _showWriteReviewSheet(
  BuildContext context, {
  required Product product,
  required GlowzaOrder order,
  required VoidCallback onSubmitted,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _WriteReviewSheet(
      product: product,
      order: order,
      onSubmitted: onSubmitted,
    ),
  );
}

class _WriteReviewSheet extends StatefulWidget {
  const _WriteReviewSheet({
    required this.product,
    required this.order,
    required this.onSubmitted,
  });

  final Product product;
  final GlowzaOrder order;
  final VoidCallback onSubmitted;

  @override
  State<_WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends State<_WriteReviewSheet> {
  final _formKey = GlobalKey<FormState>();
  final _commentController = TextEditingController();
  double _rating = 5;
  bool _submitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          shrinkWrap: true,
          children: [
            Text(
              'Write a Review',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              widget.product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7FA),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppTheme.blush),
              ),
              child: Column(
                children: [
                  const Text(
                    'How was the product?',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      final value = index + 1.0;
                      return IconButton(
                        onPressed: () => setState(() => _rating = value),
                        icon: Icon(
                          _rating >= value
                              ? Icons.star_rounded
                              : Icons.star_border_rounded,
                          color: AppTheme.gold,
                          size: 34,
                        ),
                      );
                    }),
                  ),
                  Text(
                    '${_rating.toStringAsFixed(0)} out of 5',
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _commentController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Review comment',
                hintText:
                    'Tell other customers about texture, quality, shade, or results.',
                prefixIcon: Icon(Icons.mode_comment_outlined),
              ),
              validator: (value) {
                final text = value?.trim() ?? '';
                if (text.length < 8) {
                  return 'Please write at least 8 characters.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            Text(
              'Reviews are checked by Glowza before they appear publicly.',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Submitting...' : 'Submit Review'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    setState(() => _submitting = true);
    try {
      await context.read<AppState>().submitProductReview(
        product: widget.product,
        order: widget.order,
        rating: _rating,
        comment: _commentController.text,
      );
      widget.onSubmitted();
      if (!mounted) {
        return;
      }
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Review submitted for moderation.')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Bad state: ', '')),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }
}

class _RatingBar extends StatelessWidget {
  const _RatingBar({
    required this.stars,
    required this.count,
    required this.total,
  });

  final int stars;
  final int count;
  final int total;

  @override
  Widget build(BuildContext context) {
    final progress = total == 0 ? 0.0 : count / total;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text(
              '$stars star',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                minHeight: 8,
                value: progress,
                backgroundColor: const Color(0xFFFFEEF6),
                valueColor: const AlwaysStoppedAnimation(AppTheme.primary),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 22,
            child: Text(
              '$count',
              textAlign: TextAlign.right,
              style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

class _StarRow extends StatelessWidget {
  const _StarRow({
    required this.rating,
    this.size = 16,
    this.color = AppTheme.gold,
  });

  final double rating;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final value = index + 1;
        final icon = rating >= value
            ? Icons.star_rounded
            : rating >= value - 0.5
            ? Icons.star_half_rounded
            : Icons.star_border_rounded;
        return Icon(icon, size: size, color: color);
      }),
    );
  }
}

class _ReviewChip extends StatelessWidget {
  const _ReviewChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.blush),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppTheme.primary,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

double _averageRating(List<ProductReview> reviews) {
  if (reviews.isEmpty) {
    return 0;
  }
  final total = reviews.fold<double>(0, (sum, review) => sum + review.rating);
  return total / reviews.length;
}

Map<int, int> _ratingDistribution(List<ProductReview> reviews) {
  final distribution = {for (var rating = 1; rating <= 5; rating++) rating: 0};
  for (final review in reviews) {
    final bucket = review.rating.round().clamp(1, 5).toInt();
    distribution[bucket] = (distribution[bucket] ?? 0) + 1;
  }
  return distribution;
}

String _initials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty);
  if (parts.isEmpty) {
    return 'G';
  }
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

String _formatReviewDate(String? value) {
  if (value == null || value.trim().isEmpty) {
    return '';
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    return '';
  }
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
}
