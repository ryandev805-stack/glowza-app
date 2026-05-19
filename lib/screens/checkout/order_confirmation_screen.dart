import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../providers/app_state.dart';

class OrderConfirmationScreen extends StatelessWidget {
  const OrderConfirmationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final orderId = context.watch<AppState>().lastOrderId ?? 'GLZ-000000';
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.7, end: 1),
                duration: const Duration(milliseconds: 600),
                curve: Curves.elasticOut,
                builder: (context, scale, child) =>
                    Transform.scale(scale: scale, child: child),
                child: const CircleAvatar(
                  radius: 54,
                  backgroundColor: AppTheme.blush,
                  child: Icon(
                    Icons.check_circle,
                    color: Colors.green,
                    size: 72,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Order placed successfully',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Order ID: $orderId',
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 18),
              const Text(
                'Your Cash on Delivery order is confirmed. Estimated delivery: 3 to 5 business days.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Continue Shopping'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
