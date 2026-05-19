import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/checkout_info.dart';
import '../../providers/app_state.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _address;
  late final TextEditingController _city;
  late final TextEditingController _area;
  late final TextEditingController _phone;
  bool _saveInfo = true;

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    final saved = state.savedCheckout;
    _name = TextEditingController(
      text: saved.fullName.isNotEmpty
          ? saved.fullName
          : state.user?.fullName ?? '',
    );
    _address = TextEditingController(text: saved.fullAddress);
    _city = TextEditingController(text: saved.city);
    _area = TextEditingController(text: saved.area);
    _phone = TextEditingController(
      text: saved.phoneNumber.isNotEmpty
          ? saved.phoneNumber
          : state.user?.mobileNumber ?? '',
    );
  }

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _city.dispose();
    _area.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const _PaymentCard(),
            const SizedBox(height: 18),
            _field(_name, 'Full Name', Icons.person_outline),
            _field(
              _address,
              'Full Address',
              Icons.location_on_outlined,
              maxLines: 3,
            ),
            _field(_city, 'City', Icons.location_city_outlined),
            _field(_area, 'Area', Icons.map_outlined),
            _field(
              _phone,
              'Phone Number',
              Icons.phone_android,
              keyboardType: TextInputType.phone,
            ),
            CheckboxListTile(
              value: _saveInfo,
              onChanged: (value) => setState(() => _saveInfo = value ?? false),
              contentPadding: EdgeInsets.zero,
              title: const Text('Save this information for future orders'),
            ),
            const SizedBox(height: 12),
            _Total(label: 'Subtotal', value: state.subtotal),
            _Total(label: 'Delivery', value: state.deliveryCharges),
            _Total(label: 'Grand Total', value: state.grandTotal, strong: true),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: state.cart.isEmpty
                  ? null
                  : () async {
                      if (!_formKey.currentState!.validate()) {
                        return;
                      }
                      final info = CheckoutInfo(
                        fullName: _name.text.trim(),
                        fullAddress: _address.text.trim(),
                        city: _city.text.trim(),
                        area: _area.text.trim(),
                        phoneNumber: _phone.text.trim(),
                      );
                      if (_saveInfo) {
                        await context.read<AppState>().saveCheckoutInfo(info);
                      }
                      if (!context.mounted) {
                        return;
                      }
                      try {
                        await context.read<AppState>().placeOrder(
                          checkoutInfo: info,
                        );
                      } catch (_) {
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Could not place order. Please try again.',
                            ),
                          ),
                        );
                        return;
                      }
                      if (!context.mounted) {
                        return;
                      }
                      context.go('/order-confirmation');
                    },
              child: const Text('Place COD Order'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
        validator: (value) =>
            value == null || value.trim().isEmpty ? '$label is required' : null,
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFFFE4EF)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFC2185B).withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: const ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(child: Icon(Icons.payments_outlined)),
        title: Text('Cash on Delivery'),
        subtitle: Text('Pay in cash when your Glowza order arrives.'),
        trailing: Icon(Icons.check_circle, color: Colors.green),
      ),
    );
  }
}

class _Total extends StatelessWidget {
  const _Total({required this.label, required this.value, this.strong = false});
  final String label;
  final int value;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
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
          ),
        ),
      ],
    ),
  );
}
