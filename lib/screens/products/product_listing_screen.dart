import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/product_card.dart';
import '../../models/product.dart';
import '../../providers/app_state.dart';

class ProductListingScreen extends StatefulWidget {
  const ProductListingScreen({
    super.key,
    this.initialCategory,
    this.initialSearch,
  });

  final String? initialCategory;
  final String? initialSearch;

  @override
  State<ProductListingScreen> createState() => _ProductListingScreenState();
}

class _ProductListingScreenState extends State<ProductListingScreen> {
  late final TextEditingController _searchController;
  late final ScrollController _scrollController;
  String? _category;
  String? _brand;
  RangeValues _priceRange = const RangeValues(0, 8000);
  double _rating = 0;
  String? _skinType;
  String? _productType;
  bool _discountOnly = false;
  bool _inStockOnly = false;
  String _sort = 'Popular';

  @override
  void initState() {
    super.initState();
    _category = widget.initialCategory;
    _searchController = TextEditingController(text: widget.initialSearch ?? '');
    _scrollController = ScrollController()..addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!mounted) {
      return;
    }
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 500) {
      context.read<AppState>().loadMoreProducts();
    }
  }

  List<Product> _filteredProducts(List<Product> sourceProducts) {
    var products = sourceProducts.where((product) {
      final query = _searchController.text.trim().toLowerCase();
      final matchesSearch =
          query.isEmpty ||
          '${product.name} ${product.brand} ${product.category}'
              .toLowerCase()
              .contains(query);
      return matchesSearch &&
          (_category == null || product.category == _category) &&
          (_brand == null || product.brand == _brand) &&
          product.price >= _priceRange.start &&
          product.price <= _priceRange.end &&
          product.rating >= _rating &&
          (_skinType == null || product.skinType == _skinType) &&
          (_productType == null || product.productType == _productType) &&
          (!_discountOnly || product.discountPercent > 0) &&
          (!_inStockOnly || product.inStock);
    }).toList();

    products.sort((a, b) {
      switch (_sort) {
        case 'Newest':
          return b.isNew.toString().compareTo(a.isNew.toString());
        case 'Price Low to High':
          return a.price.compareTo(b.price);
        case 'Price High to Low':
          return b.price.compareTo(a.price);
        case 'Highest Rated':
          return b.rating.compareTo(a.rating);
        default:
          return b.reviewCount.compareTo(a.reviewCount);
      }
    });
    return products;
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final products = _filteredProducts(appState.products);
    return Scaffold(
      appBar: AppBar(title: Text(_category ?? 'Products')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      hintText: 'Search products',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  onPressed: _showFilters,
                  icon: const Icon(Icons.tune),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: DropdownButtonFormField<String>(
              initialValue: _sort,
              decoration: const InputDecoration(labelText: 'Sort'),
              items:
                  [
                        'Popular',
                        'Newest',
                        'Price Low to High',
                        'Price High to Low',
                        'Highest Rated',
                      ]
                      .map(
                        (sort) =>
                            DropdownMenuItem(value: sort, child: Text(sort)),
                      )
                      .toList(),
              onChanged: (value) => setState(() => _sort = value ?? 'Popular'),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: GridView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 230,
                childAspectRatio: 0.57,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount:
                  products.length + (appState.isLoadingMoreProducts ? 1 : 0),
              itemBuilder: (context, index) {
                if (index >= products.length) {
                  return const Center(child: CircularProgressIndicator());
                }
                return ProductCard(product: products[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showFilters() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        final appState = context.read<AppState>();
        final brands = appState.products.map((p) => p.brand).toSet().toList()
          ..sort();
        final skinTypes =
            appState.products.map((p) => p.skinType).toSet().toList()..sort();
        final productTypes =
            appState.products.map((p) => p.productType).toSet().toList()
              ..sort();
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.84,
              builder: (_, controller) => ListView(
                controller: controller,
                padding: const EdgeInsets.all(20),
                children: [
                  Text(
                    'Filters',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _dropdown(
                    'Category',
                    _category,
                    appState.categories.map((c) => c.name).toList(),
                    (v) => setSheetState(() => _category = v),
                  ),
                  _dropdown(
                    'Brand',
                    _brand,
                    brands,
                    (v) => setSheetState(() => _brand = v),
                  ),
                  Text(
                    'Price range: PKR ${_priceRange.start.round()} - ${_priceRange.end.round()}',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  RangeSlider(
                    values: _priceRange,
                    min: 0,
                    max: 8000,
                    divisions: 16,
                    onChanged: (v) => setSheetState(() => _priceRange = v),
                  ),
                  _dropdown(
                    'Rating',
                    _rating == 0 ? null : '$_rating+',
                    ['4.0+', '4.5+', '4.8+'],
                    (v) => setSheetState(
                      () => _rating =
                          double.tryParse(v?.replaceAll('+', '') ?? '0') ?? 0,
                    ),
                  ),
                  _dropdown(
                    'Skin type',
                    _skinType,
                    skinTypes,
                    (v) => setSheetState(() => _skinType = v),
                  ),
                  _dropdown(
                    'Product type',
                    _productType,
                    productTypes,
                    (v) => setSheetState(() => _productType = v),
                  ),
                  SwitchListTile(
                    value: _discountOnly,
                    onChanged: (v) => setSheetState(() => _discountOnly = v),
                    title: const Text('Discounted items only'),
                  ),
                  SwitchListTile(
                    value: _inStockOnly,
                    onChanged: (v) => setSheetState(() => _inStockOnly = v),
                    title: const Text('Available in stock only'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {});
                      Navigator.pop(context);
                    },
                    child: const Text('Apply Filters'),
                  ),
                  TextButton(
                    onPressed: () {
                      setSheetState(() {
                        _category = null;
                        _brand = null;
                        _priceRange = const RangeValues(0, 8000);
                        _rating = 0;
                        _skinType = null;
                        _productType = null;
                        _discountOnly = false;
                        _inStockOnly = false;
                      });
                    },
                    child: const Text('Clear all'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _dropdown(
    String label,
    String? value,
    List<String> items,
    ValueChanged<String?> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: value,
        decoration: InputDecoration(labelText: label),
        items: [
          const DropdownMenuItem<String>(value: null, child: Text('Any')),
          ...items.map(
            (item) => DropdownMenuItem(value: item, child: Text(item)),
          ),
        ],
        onChanged: onChanged,
      ),
    );
  }
}
