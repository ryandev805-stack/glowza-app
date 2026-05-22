import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/product_image.dart';
import '../../models/checkout_info.dart';
import '../../models/order.dart';
import '../../providers/app_state.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final user = state.user;
    final saved = state.savedCheckout;
    final wishlistProducts = state.products
        .where((product) => state.wishlist.contains(product.id))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            tooltip: 'Refresh orders',
            onPressed: () => context.read<AppState>().loadUserOrders(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: user == null
          ? const EmptyState(
              icon: Icons.person_outline,
              title: 'Not signed in',
              message: 'Login to view profile details.',
            )
          : RefreshIndicator(
              onRefresh: () => context.read<AppState>().loadUserOrders(),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                children: [
                  _ProfileHeader(
                    name: user.fullName,
                    phone: user.mobileNumber,
                    orderCount: state.orders.length,
                    wishlistCount: state.wishlist.length,
                    hasAddress: saved.fullAddress.trim().isNotEmpty,
                  ),
                  const SizedBox(height: 16),
                  _DeliveryCard(info: saved, fallbackPhone: user.mobileNumber),
                  const SizedBox(height: 16),
                  _SectionHeader(
                    title: 'My Orders',
                    actionLabel: state.orders.isEmpty ? null : 'Refresh',
                    onAction: state.orders.isEmpty
                        ? null
                        : () => context.read<AppState>().loadUserOrders(),
                  ),
                  if (state.orders.isEmpty)
                    const _CompactEmpty(
                      icon: Icons.receipt_long_outlined,
                      title: 'No orders yet',
                      message: 'Your placed orders will appear here.',
                    )
                  else
                    ...state.orders
                        .take(5)
                        .map((order) => _OrderTile(order: order)),
                  const SizedBox(height: 16),
                  _SectionHeader(title: 'Wishlist'),
                  if (wishlistProducts.isEmpty)
                    const _CompactEmpty(
                      icon: Icons.favorite_border,
                      title: 'Wishlist is empty',
                      message: 'Save products you want to buy later.',
                    )
                  else
                    ...wishlistProducts.map(
                      (product) => _WishlistTile(productId: product.id),
                    ),
                  const SizedBox(height: 16),
                  _SettingsCard(
                    phone: saved.phoneNumber.isEmpty
                        ? user.mobileNumber
                        : saved.phoneNumber,
                  ),
                  const SizedBox(height: 18),
                  OutlinedButton.icon(
                    onPressed: () => _confirmLogout(context),
                    icon: const Icon(Icons.logout),
                    label: const Text('Logout'),
                  ),
                ],
              ),
            ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.phone,
    required this.orderCount,
    required this.wishlistCount,
    required this.hasAddress,
  });

  final String name;
  final String phone;
  final int orderCount;
  final int wishlistCount;
  final bool hasAddress;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.plum, AppTheme.wine, AppTheme.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.22),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 34,
                backgroundColor: Colors.white,
                child: Text(
                  _initials(name),
                  style: const TextStyle(
                    color: AppTheme.primary,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 21,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      phone,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.86),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _HeaderMetric(
                  label: 'Orders',
                  value: '$orderCount',
                  icon: Icons.receipt_long_outlined,
                ),
              ),
              Expanded(
                child: _HeaderMetric(
                  label: 'Wishlist',
                  value: '$wishlistCount',
                  icon: Icons.favorite_border,
                ),
              ),
              Expanded(
                child: _HeaderMetric(
                  label: 'Address',
                  value: hasAddress ? 'Saved' : 'Add',
                  icon: Icons.location_on_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeaderMetric extends StatelessWidget {
  const _HeaderMetric({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        children: [
          Icon(icon, color: Colors.white, size: 18),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.78),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({required this.info, required this.fallbackPhone});

  final CheckoutInfo info;
  final String fallbackPhone;

  @override
  Widget build(BuildContext context) {
    final hasAddress = info.fullAddress.trim().isNotEmpty;
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            title: 'Delivery Details',
            actionLabel: hasAddress ? 'Edit' : 'Add',
            onAction: () => _showDeliverySheet(context, info, fallbackPhone),
            dense: true,
          ),
          const SizedBox(height: 12),
          _DetailRow(
            icon: Icons.location_on_outlined,
            label: 'Address',
            value: hasAddress
                ? '${info.fullAddress}, ${info.area}, ${info.city}'
                : 'No saved address yet',
          ),
          _DetailRow(
            icon: Icons.phone_android,
            label: 'Phone',
            value: info.phoneNumber.isEmpty ? fallbackPhone : info.phoneNumber,
            isLast: true,
          ),
        ],
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});

  final GlowzaOrder order;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: () => _showOrderDetails(context, order),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppTheme.blush,
            child: Icon(_statusIcon(order.status), color: AppTheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.orderNumber,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  '${order.totalItems} item${order.totalItems == 1 ? '' : 's'} - PKR ${order.total}',
                  style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                ),
              ],
            ),
          ),
          _StatusPill(status: order.status),
        ],
      ),
    );
  }
}

class _WishlistTile extends StatelessWidget {
  const _WishlistTile({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final matches = state.products.where((item) => item.id == productId);
    final product = matches.isEmpty ? null : matches.first;
    if (product == null) {
      return const SizedBox.shrink();
    }
    return _SurfaceCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: () => context.push('/product/${product.id}'),
      child: Row(
        children: [
          SizedBox(
            width: 58,
            height: 58,
            child: ProductImage(imageUrl: product.imageUrl, borderRadius: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  'PKR ${product.price}',
                  style: const TextStyle(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Add to cart',
            onPressed: () => context.read<AppState>().addToCart(product),
            icon: const Icon(Icons.add_shopping_cart),
          ),
          IconButton(
            tooltip: 'Remove',
            onPressed: () =>
                context.read<AppState>().toggleWishlist(product.id),
            icon: const Icon(Icons.favorite, color: AppTheme.primary),
          ),
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.phone});

  final String phone;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        children: [
          _SettingsRow(
            icon: Icons.payments_outlined,
            title: 'Payment',
            subtitle: 'Cash on Delivery only',
          ),
          _SettingsRow(
            icon: Icons.support_agent,
            title: 'Support',
            subtitle: phone.isEmpty
                ? 'Add phone number for order support'
                : phone,
          ),
          const _SettingsRow(
            icon: Icons.notifications_none,
            title: 'Notifications',
            subtitle: 'Order updates will use your phone number',
            isLast: true,
          ),
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.isLast = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return _DetailRow(
      icon: icon,
      label: title,
      value: subtitle,
      isLast: isLast,
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 19,
            backgroundColor: AppTheme.blush,
            child: Icon(icon, size: 19, color: AppTheme.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
    this.dense = false,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: dense ? 16 : 18,
            ),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  const _SurfaceCard({
    required this.child,
    this.margin = EdgeInsets.zero,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      margin: margin,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.blush.withValues(alpha: 0.8)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) {
      return card;
    }

    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: card,
    );
  }
}

class _CompactEmpty extends StatelessWidget {
  const _CompactEmpty({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppTheme.blush,
            child: Icon(icon, color: AppTheme.primary),
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
                Text(message, style: TextStyle(color: Colors.grey.shade600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _statusColor(status).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.isEmpty ? 'pending' : status,
        style: TextStyle(
          color: _statusColor(status),
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

Future<void> _showDeliverySheet(
  BuildContext context,
  CheckoutInfo info,
  String fallbackPhone,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _DeliverySheet(info: info, fallbackPhone: fallbackPhone),
  );
}

class _DeliverySheet extends StatefulWidget {
  const _DeliverySheet({required this.info, required this.fallbackPhone});

  final CheckoutInfo info;
  final String fallbackPhone;

  @override
  State<_DeliverySheet> createState() => _DeliverySheetState();
}

class _DeliverySheetState extends State<_DeliverySheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullName;
  late final TextEditingController _address;
  late final TextEditingController _city;
  late final TextEditingController _area;
  late final TextEditingController _phone;

  @override
  void initState() {
    super.initState();
    _fullName = TextEditingController(text: widget.info.fullName);
    _address = TextEditingController(text: widget.info.fullAddress);
    _city = TextEditingController(text: widget.info.city);
    _area = TextEditingController(text: widget.info.area);
    _phone = TextEditingController(
      text: widget.info.phoneNumber.isEmpty
          ? widget.fallbackPhone
          : widget.info.phoneNumber,
    );
  }

  @override
  void dispose() {
    _fullName.dispose();
    _address.dispose();
    _city.dispose();
    _area.dispose();
    _phone.dispose();
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
              'Delivery Details',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            _field(_fullName, 'Full Name', Icons.person_outline),
            _field(_address, 'Full Address', Icons.home_outlined),
            Row(
              children: [
                Expanded(child: _field(_city, 'City', Icons.location_city)),
                const SizedBox(width: 10),
                Expanded(
                  child: _field(_area, 'Area', Icons.location_on_outlined),
                ),
              ],
            ),
            _field(_phone, 'Phone Number', Icons.phone_android),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _save,
              child: const Text('Save Delivery Details'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
        validator: (value) =>
            value == null || value.trim().isEmpty ? 'Required' : null,
      ),
    );
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    await context.read<AppState>().saveCheckoutInfo(
      CheckoutInfo(
        fullName: _fullName.text.trim(),
        fullAddress: _address.text.trim(),
        city: _city.text.trim(),
        area: _area.text.trim(),
        nearbyPlace: widget.info.nearbyPlace,
        phoneNumber: _phone.text.trim(),
      ),
    );
    if (mounted) {
      Navigator.pop(context);
    }
  }
}

Future<void> _showOrderDetails(BuildContext context, GlowzaOrder order) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) {
      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.78,
        maxChildSize: 0.92,
        builder: (context, controller) {
          return ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      order.orderNumber,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  _StatusPill(status: order.status),
                ],
              ),
              const SizedBox(height: 14),
              _DetailRow(
                icon: Icons.payments_outlined,
                label: 'Payment',
                value: '${order.paymentMethod} - ${order.paymentStatus}',
              ),
              _DetailRow(
                icon: Icons.location_on_outlined,
                label: 'Delivery',
                value: '${order.address}, ${order.city}',
              ),
              if (order.nearbyPlace.isNotEmpty)
                _DetailRow(
                  icon: Icons.place_outlined,
                  label: 'Nearby place',
                  value: order.nearbyPlace,
                ),
              _DetailRow(
                icon: Icons.phone_android,
                label: 'Customer',
                value: '${order.customerName} - ${order.customerPhone}',
                isLast: true,
              ),
              const SizedBox(height: 18),
              const _SectionHeader(title: 'Products', dense: true),
              const SizedBox(height: 8),
              ...order.products.map(
                (product) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 52,
                        height: 52,
                        child: ProductImage(
                          imageUrl: product.image,
                          borderRadius: 14,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text('x${product.quantity}'),
                      const SizedBox(width: 10),
                      Text(
                        'PKR ${product.price}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(height: 24),
              _AmountRow(label: 'Subtotal', value: order.subtotal),
              _AmountRow(label: 'Shipping', value: order.shippingFee),
              _AmountRow(label: 'Discount', value: -order.discount),
              _AmountRow(label: 'Total', value: order.total, isTotal: true),
            ],
          );
        },
      );
    },
  );
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.isTotal = false,
  });

  final String label;
  final int value;
  final bool isTotal;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontWeight: isTotal ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          Text(
            'PKR $value',
            style: TextStyle(
              color: isTotal ? AppTheme.primary : AppTheme.plum,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _confirmLogout(BuildContext context) async {
  final shouldLogout = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Logout?'),
      content: const Text('You will need to enter your name and phone again.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Logout'),
        ),
      ],
    ),
  );
  if (shouldLogout != true || !context.mounted) {
    return;
  }
  await context.read<AppState>().logout();
  if (context.mounted) {
    context.go('/login');
  }
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

IconData _statusIcon(String status) {
  final normalized = status.toLowerCase();
  if (normalized.contains('deliver')) {
    return Icons.verified_outlined;
  }
  if (normalized.contains('cancel')) {
    return Icons.cancel_outlined;
  }
  if (normalized.contains('ship')) {
    return Icons.local_shipping_outlined;
  }
  return Icons.schedule_outlined;
}

Color _statusColor(String status) {
  final normalized = status.toLowerCase();
  if (normalized.contains('deliver')) {
    return const Color(0xFF18864B);
  }
  if (normalized.contains('cancel')) {
    return const Color(0xFFB3261E);
  }
  if (normalized.contains('ship')) {
    return const Color(0xFF8A5A00);
  }
  return AppTheme.primary;
}
