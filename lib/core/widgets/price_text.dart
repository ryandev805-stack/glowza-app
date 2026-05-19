import 'package:flutter/material.dart';

class PriceText extends StatelessWidget {
  const PriceText({
    super.key,
    required this.price,
    this.oldPrice,
    this.large = false,
  });

  final int price;
  final int? oldPrice;
  final bool large;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      children: [
        Text(
          'PKR $price',
          style: TextStyle(
            fontSize: large ? 18 : 15,
            fontWeight: FontWeight.w700,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        if (oldPrice != null)
          Text(
            'PKR $oldPrice',
            style: TextStyle(
              color: Colors.grey.shade500,
              decoration: TextDecoration.lineThrough,
              fontWeight: FontWeight.w400,
            ),
          ),
      ],
    );
  }
}
