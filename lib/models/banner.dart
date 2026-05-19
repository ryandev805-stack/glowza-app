import 'package:cloud_firestore/cloud_firestore.dart';

class AppBanner {
  const AppBanner({
    required this.id,
    required this.title,
    required this.image,
    required this.link,
    required this.isActive,
    required this.sortOrder,
  });

  final String id;
  final String title;
  final String image;
  final String link;
  final bool isActive;
  final int sortOrder;

  factory AppBanner.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AppBanner(
      id: doc.id,
      title: data['title'] as String? ?? '',
      image: data['image'] as String? ?? '',
      link: data['link'] as String? ?? '',
      isActive: data['isActive'] as bool? ?? true,
      sortOrder: (data['sortOrder'] as num?)?.round() ?? 0,
    );
  }
}
