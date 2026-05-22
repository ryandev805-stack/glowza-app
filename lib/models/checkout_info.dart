class CheckoutInfo {
  const CheckoutInfo({
    required this.fullName,
    required this.fullAddress,
    required this.city,
    required this.area,
    required this.nearbyPlace,
    required this.phoneNumber,
    this.emailAddress = '',
  });

  final String fullName;
  final String fullAddress;
  final String city;
  final String area;
  final String nearbyPlace;
  final String phoneNumber;
  final String emailAddress;

  bool get isComplete =>
      fullName.isNotEmpty &&
      fullAddress.isNotEmpty &&
      city.isNotEmpty &&
      area.isNotEmpty &&
      nearbyPlace.isNotEmpty &&
      phoneNumber.isNotEmpty;

  Map<String, String> toJson() => {
    'fullName': fullName,
    'fullAddress': fullAddress,
    'city': city,
    'area': area,
    'nearbyPlace': nearbyPlace,
    'phoneNumber': phoneNumber,
    'emailAddress': emailAddress,
  };

  factory CheckoutInfo.empty() {
    return const CheckoutInfo(
      fullName: '',
      fullAddress: '',
      city: '',
      area: '',
      nearbyPlace: '',
      phoneNumber: '',
      emailAddress: '',
    );
  }

  factory CheckoutInfo.fromJson(Map<String, dynamic> json) {
    return CheckoutInfo(
      fullName: json['fullName'] as String? ?? '',
      fullAddress: json['fullAddress'] as String? ?? '',
      city: json['city'] as String? ?? '',
      area: json['area'] as String? ?? '',
      nearbyPlace: json['nearbyPlace'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      emailAddress: json['emailAddress'] as String? ?? '',
    );
  }
}
