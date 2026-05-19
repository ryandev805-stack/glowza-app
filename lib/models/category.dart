import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class Category {
  const Category({
    required this.id,
    required this.name,
    this.image = '',
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
    IconData? icon,
  }) : icon = icon ?? Icons.spa;

  final String id;
  final String name;
  final String image;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final IconData icon;

  factory Category.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final name = data['name'] as String? ?? '';
    return Category(
      id: doc.id,
      name: name,
      image: data['image'] as String? ?? '',
      isActive: data['isActive'] as bool? ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
      icon: iconForName(name),
    );
  }

  Map<String, Object?> toFirestore({bool includeCreatedAt = false}) {
    return {
      'name': name,
      'image': image,
      'isActive': isActive,
      if (includeCreatedAt) 'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  static IconData iconForName(String name) {
    final normalized = name.toLowerCase();
    if (normalized.contains('makeup')) return Icons.face_retouching_natural;
    if (normalized.contains('skin')) return Icons.spa;
    if (normalized.contains('hair')) return Icons.brush;
    if (normalized.contains('fragrance')) return Icons.local_florist;
    if (normalized.contains('tool')) return Icons.auto_fix_high;
    if (normalized.contains('nail')) return Icons.back_hand;
    if (normalized.contains('korean')) return Icons.water_drop;
    if (normalized.contains('men')) return Icons.person;
    return Icons.spa;
  }
}
