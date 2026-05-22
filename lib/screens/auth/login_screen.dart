import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/glowza_logo.dart';
import '../../providers/app_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFFFF7FA), Color(0xFFFFE4EF), Colors.white],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 38),
              const GlowzaLogo(),
              const SizedBox(height: 18),
              Text(
                'Pakistan online shopping made simple, stylish, and reliable.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: const Color(0xFF6A2848),
                  height: 1.45,
                  fontWeight: FontWeight.w400,
                ),
              ),
              const SizedBox(height: 34),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFFFFC7DD)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFC2185B).withValues(alpha: 0.12),
                      blurRadius: 36,
                      offset: const Offset(0, 18),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _nameController,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Full Name',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: (value) =>
                            value == null || value.trim().length < 3
                            ? 'Enter your full name'
                            : null,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _mobileController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          prefixText: '+92 ',
                          labelText: 'Mobile Number',
                          prefixIcon: Icon(Icons.phone_android),
                        ),
                        validator: (value) {
                          final digits =
                              value?.replaceAll(RegExp(r'\D'), '') ?? '';
                          if (digits.length < 10) {
                            return 'Enter a valid Pakistan mobile number';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 24),
                      Consumer<AppState>(
                        builder: (context, appState, child) {
                          return ElevatedButton(
                            onPressed: appState.isBusy ? null : _submit,
                            child: appState.isBusy
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Continue Securely'),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final raw = _mobileController.text.replaceAll(RegExp(r'\D'), '');
    final normalized = raw.startsWith('92') ? '+$raw' : '+92$raw';
    try {
      await context.read<AppState>().login(
        _nameController.text.trim(),
        normalized,
      );
      if (mounted) {
        context.go('/home');
      }
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not sign in. Please try again.')),
      );
    }
  }
}
