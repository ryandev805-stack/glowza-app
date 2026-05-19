import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class GlowzaLogo extends StatelessWidget {
  const GlowzaLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Image.asset(
            'app_icon.png',
            width: compact ? 42 : 58,
            height: compact ? 42 : 58,
            fit: BoxFit.cover,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          'Glowza',
          style: TextStyle(
            fontSize: compact ? 24 : 34,
            fontWeight: FontWeight.w700,
            color: AppTheme.plum,
          ),
        ),
      ],
    );
  }
}
