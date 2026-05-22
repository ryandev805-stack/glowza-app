import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/glowza_logo.dart';
import '../../core/widgets/product_card.dart';
import '../../core/widgets/product_image.dart';
import '../../core/widgets/section_header.dart';
import '../../models/banner.dart';
import '../../models/category.dart';
import '../../models/product.dart';
import '../../providers/app_state.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AppState>().user;
    final categories = context.watch<AppState>().categories;
    final products = context.watch<AppState>().products;
    final banners = context.watch<AppState>().banners;
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(child: GlowzaLogo(compact: true)),
                        IconButton.filledTonal(
                          onPressed: () => context.go('/cart'),
                          icon: const Icon(Icons.shopping_bag_outlined),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Hello, ${user?.fullName.split(' ').first ?? 'Shopper'}',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Fresh finds across fashion, beauty, home, tech and more.',
                      style: TextStyle(
                        color: AppTheme.wine,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      readOnly: true,
                      onTap: () => context.push('/products'),
                      decoration: const InputDecoration(
                        hintText: 'Search fashion, gadgets, home items...',
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 18),
                    _PromoCarousel(
                      banners: banners,
                      fallbackProducts: products.take(4).toList(),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(child: _CategoryRail(categories: categories)),
            _ProductSection(
              title: 'Flash Sale',
              products: products.where((p) => p.isFlashSale).toList(),
            ),
            _ProductSection(
              title: 'Best Sellers',
              products: products.where((p) => p.isBestSeller).toList(),
            ),
            _ProductSection(
              title: 'New Arrivals',
              products: products.where((p) => p.isNew).toList(),
            ),
            _ProductSection(
              title: 'Recommended Products',
              products: products.take(8).toList(),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

class _PromoCarousel extends StatelessWidget {
  const _PromoCarousel({required this.banners, required this.fallbackProducts});

  final List<AppBanner> banners;
  final List<Product> fallbackProducts;

  @override
  Widget build(BuildContext context) {
    if (banners.isEmpty && fallbackProducts.isEmpty) {
      return const SizedBox.shrink();
    }

    final itemCount = banners.isNotEmpty
        ? banners.length
        : fallbackProducts.length;
    return SizedBox(
      height: 168,
      child: DecoratedBox(
        decoration: const BoxDecoration(color: Color(0xFFFFF7FA)),
        child: PageView.builder(
          itemCount: itemCount,
          controller: PageController(),
          itemBuilder: (context, index) {
            final banner = banners.isNotEmpty ? banners[index] : null;
            final product = banners.isEmpty ? fallbackProducts[index] : null;
            final image = banner?.image ?? product?.imageUrl ?? '';
            final link =
                banner?.link ??
                (product == null ? '' : '/product/${product.id}');
            return InkWell(
              onTap: link.isEmpty ? null : () => context.push(link),
              borderRadius: BorderRadius.circular(26),
              child: ColoredBox(
                color: const Color(0xFFFFF7FA),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(26),
                  child: ProductImage(imageUrl: image, borderRadius: 26),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CategoryRail extends StatelessWidget {
  const _CategoryRail({required this.categories});

  final List<Category> categories;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SectionHeader(
          title: 'Categories',
          actionLabel: 'View all',
          onAction: () => context.go('/categories'),
        ),
        SizedBox(
          height: 110,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            scrollDirection: Axis.horizontal,
            itemCount: categories.length,
            separatorBuilder: (context, index) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final category = categories[index];
              return InkWell(
                onTap: () => context.push(
                  '/products?category=${Uri.encodeComponent(category.name)}',
                ),
                // borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 70,
                  padding: const EdgeInsets.all(0),
                  // decoration: BoxDecoration(
                  //   color: Colors.white,
                  //   borderRadius: BorderRadius.circular(20),
                  // ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (category.image.isNotEmpty)
                        SizedBox(
                          width: 70,
                          height: 70,
                          child: ProductImage(
                            imageUrl: category.image,
                            borderRadius: 9,
                          ),
                        )
                      else
                        Icon(category.icon, color: AppTheme.primary),
                      const SizedBox(height: 2),
                      Text(
                        category.name,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ProductSection extends StatelessWidget {
  const _ProductSection({required this.title, required this.products});

  final String title;
  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Column(
        children: [
          SectionHeader(
            title: title,
            actionLabel: 'See all',
            onAction: () => context.push('/products'),
          ),
          SizedBox(
            height: 270,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (context, index) => const SizedBox(width: 14),
              itemBuilder: (context, index) => SizedBox(
                width: 150,
                child: ProductCard(product: products[index]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
