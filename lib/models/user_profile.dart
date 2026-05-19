import 'package:cloud_firestore/cloud_firestore.dart';

typedef User = UserProfile;

class UserProfile {
  const UserProfile({
    required this.id,
    required this.fullName,
    required this.mobileNumber,
    this.role = 'customer',
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String fullName;
  final String mobileNumber;
  final String role;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get name => fullName;
  String get phone => mobileNumber;

  Map<String, String> toJson() => {
    'id': id,
    'fullName': fullName,
    'mobileNumber': mobileNumber,
    'role': role,
  };

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      mobileNumber: json['mobileNumber'] as String? ?? '',
      role: json['role'] as String? ?? 'customer',
    );
  }

  factory UserProfile.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? {};
    return UserProfile(
      id: doc.id,
      fullName: data['name'] as String? ?? '',
      mobileNumber: data['phone'] as String? ?? '',
      role: data['role'] as String? ?? 'customer',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, Object?> toFirestore({bool includeCreatedAt = false}) {
    return {
      'name': fullName,
      'phone': mobileNumber,
      'role': role,
      if (includeCreatedAt) 'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }
}
