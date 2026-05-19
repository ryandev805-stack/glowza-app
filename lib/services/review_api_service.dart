import 'dart:convert';

import 'package:http/http.dart' as http;

class ReviewApiService {
  const ReviewApiService({
    this.baseUrl = const String.fromEnvironment('GLOWZA_API_BASE_URL'),
  });

  final String baseUrl;

  bool get isConfigured => baseUrl.trim().isNotEmpty;

  Future<void> submitReview({
    required String userId,
    required String productId,
    required String orderId,
    required double rating,
    required String comment,
    required String customerName,
  }) async {
    final response = await http.post(
      Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/submit-review'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'userId': userId,
        'productId': productId,
        'orderId': orderId,
        'rating': rating,
        'comment': comment,
        'customerName': customerName,
      }),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(body['error'] as String? ?? 'Could not submit review.');
    }
  }
}
