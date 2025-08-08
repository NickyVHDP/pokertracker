import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // iOS: enable shared cookies before runApp (safe defaults)
  if (!kIsWeb && Platform.isIOS) {
    await InAppWebViewController.setSharedCookiesEnabled(true);
  }
  runApp(const PokerTrackrWrapper());
}

class PokerTrackrWrapper extends StatelessWidget {
  const PokerTrackrWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PokerTrackr',
      theme: ThemeData(useMaterial3: true, brightness: Brightness.light),
      darkTheme: ThemeData(useMaterial3: true, brightness: Brightness.dark),
      home: const WebShell(),
    );
  }
}

class WebShell extends StatefulWidget {
  const WebShell({super.key});
  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> {
  InAppWebViewController? _controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: InAppWebView(
          initialSettings: InAppWebViewSettings(
            javaScriptEnabled: true,
            allowsInlineMediaPlayback: true,
            transparentBackground: true,
            mediaPlaybackRequiresUserGesture: false,
          ),
          onWebViewCreated: (c) async {
            _controller = c;

            // Load your built index.html from assets and keep relative paths working
            final html = await rootBundle.loadString('assets/www/index.html');
            final baseUrl = WebUri('file:///assets/www/');
            await _controller!.loadData(
              data: html,
              baseUrl: baseUrl,
              mimeType: 'text/html',
              historyUrl: baseUrl,
              encoding: 'utf-8',
            );
          },
        ),
      ),
    );
  }
}
