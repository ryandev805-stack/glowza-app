import 'package:flutter_test/flutter_test.dart';
import 'package:glowza/app.dart';
import 'package:glowza/providers/app_state.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets('Glowza app starts', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState(),
        child: const GlowzaApp(),
      ),
    );

    expect(find.text('Glowza'), findsOneWidget);
  });
}
