import 'package:flutter/material.dart';

class SectionWidget extends StatelessWidget {
  final String icon;
  final String title;
  final List<Widget> children;

  const SectionWidget({
    super.key,
    required this.icon,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFDBEAFE), Color(0xFFE0E7FF)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(icon, style: const TextStyle(fontSize: 24)),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

class RuleWidget extends StatelessWidget {
  final String icon;
  final String text;
  final bool isDo;

  const RuleWidget({
    super.key,
    required this.icon,
    required this.text,
    required this.isDo,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDo ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
        border: Border.all(
          color: isDo ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 14,
                color: isDo ? const Color(0xFF166534) : const Color(0xFF991B1B),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class TipWidget extends StatelessWidget {
  final String emoji;
  final String title;
  final String desc;
  final List<Color> colors;
  final Color borderColor;
  final Color titleColor;
  final Color descColor;

  const TipWidget({
    super.key,
    required this.emoji,
    required this.title,
    required this.desc,
    required this.colors,
    required this.borderColor,
    required this.titleColor,
    required this.descColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: colors),
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: titleColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(desc, style: TextStyle(fontSize: 13, color: descColor)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class BulletTextWidget extends StatelessWidget {
  final String label;
  final String text;
  final bool highlightValue;

  const BulletTextWidget({
    super.key,
    required this.label,
    required this.text,
    this.highlightValue = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '• ',
            style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold),
          ),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 14, color: Color(0xFF1E3A8A)),
                children: [
                  TextSpan(
                    text: label,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  TextSpan(
                    text: text,
                    style: highlightValue
                        ? const TextStyle(
                            color: Colors.red,
                            fontWeight: FontWeight.bold,
                          )
                        : null,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WarningStepWidget extends StatelessWidget {
  final String step;
  final String desc;
  final bool isCritical;

  const WarningStepWidget({
    super.key,
    required this.step,
    required this.desc,
    this.isCritical = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isCritical ? Colors.red.shade600 : Colors.white,
        border: Border.all(color: Colors.red.shade100),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isCritical ? Colors.red.shade800 : Colors.red.shade100,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              step,
              style: TextStyle(
                fontSize: 12,
                fontFamily: 'monospace',
                color: isCritical ? Colors.white : Colors.red.shade900,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              desc,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isCritical ? FontWeight.bold : FontWeight.normal,
                color: isCritical ? Colors.white : Colors.red.shade900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
