import 'package:flutter/material.dart';

import '../constants/app_constants.dart';

class AppTheme {
  static const fontFamily = 'Gopher';
  static const primary = Color(AppConstants.primaryPink);
  static const blush = Color(AppConstants.blushPink);
  static const lavender = Color(AppConstants.softLavender);
  static const gold = Color(AppConstants.goldAccent);
  static const plum = Color(AppConstants.deepPlum);
  static const wine = Color(AppConstants.roseWine);

  static ThemeData get lightTheme {
    final base = ThemeData.light(useMaterial3: true);
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: wine,
      tertiary: gold,
      surface: Colors.white,
      brightness: Brightness.light,
    );

    return base.copyWith(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFFFFF7FA),
      primaryTextTheme: base.primaryTextTheme.apply(
        fontFamily: fontFamily,
        bodyColor: plum,
        displayColor: plum,
      ),
      textTheme: base.textTheme.apply(
        fontFamily: fontFamily,
        bodyColor: plum,
        displayColor: plum,
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Color(0xFFFFF7FA),
        foregroundColor: plum,
        titleTextStyle: TextStyle(
          color: plum,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          fontFamily: fontFamily,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        labelStyle: const TextStyle(color: wine, fontWeight: FontWeight.w500),
        hintStyle: TextStyle(
          color: plum.withValues(alpha: 0.48),
          fontWeight: FontWeight.w400,
        ),
        prefixIconColor: wine,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFFFC7DD)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFFFC7DD)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: primary, width: 1.6),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFFE8B4C8),
          elevation: 0,
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: const BorderSide(color: primary, width: 1.2),
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: blush,
        elevation: 10,
        shadowColor: primary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w400,
            color: states.contains(WidgetState.selected) ? primary : plum,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? primary : plum,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: blush,
        selectedColor: primary,
        labelStyle: const TextStyle(fontWeight: FontWeight.w500, color: plum),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        side: BorderSide.none,
      ),
    );
  }
}
