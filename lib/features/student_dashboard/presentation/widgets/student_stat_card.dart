import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'dart:math';

class StudentStatCard extends StatelessWidget {
  final String iconEmoji;
  final List<Color> iconBgColors;
  final String title;
  final String value;
  final String subtitle;
  final List<num> chartData;
  final List<Color> barGradientColors;

  const StudentStatCard({
    super.key,
    required this.iconEmoji,
    required this.iconBgColors,
    required this.title,
    required this.value,
    required this.subtitle,
    required this.chartData,
    required this.barGradientColors,
  });

  @override
  Widget build(BuildContext context) {
    // Tìm giá trị lớn nhất trong mảng để fl_chart tự tính chiều cao cột
    final double maxY = chartData.isEmpty
        ? 1
        : chartData.map((e) => e.toDouble()).reduce(max);
    // Nếu maxY = 0 (tất cả đều là 0), gán tạm maxY = 1 để biểu đồ không bị lỗi chia cho 0
    final double safeMaxY = maxY <= 0 ? 1 : maxY;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Icon + Tiêu đề phụ
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: iconBgColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(iconEmoji, style: const TextStyle(fontSize: 24)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Giá trị chính
          Text(
            value,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),
          // Biểu đồ Mini (fl_chart)
          Container(
            height: 64, // Chiều cao cố định cho biểu đồ
            padding: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child:
                chartData.every((e) => e == 0) // Nếu tất cả dữ liệu là 0
                ? const Center(
                    child: Text(
                      'Không có dữ liệu',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  )
                : BarChart(
                    BarChartData(
                      maxY: safeMaxY * 1.2, // Chừa 20% khoảng trống phía trên
                      minY: 0,
                      gridData: const FlGridData(show: false), // Ẩn lưới
                      titlesData: const FlTitlesData(
                        show: false,
                      ), // Ẩn chữ (trục X, Y)
                      borderData: FlBorderData(show: false), // Ẩn viền biểu đồ
                      barTouchData: BarTouchData(
                        enabled: false,
                      ), // Không cần tương tác chạm
                      barGroups: chartData.asMap().entries.map((entry) {
                        return BarChartGroupData(
                          x: entry.key,
                          barRods: [
                            BarChartRodData(
                              toY: entry.value.toDouble(),
                              width: 12, // Độ rộng của cột
                              gradient: LinearGradient(
                                colors: barGradientColors,
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                              ),
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(4),
                              ),
                              backDrawRodData: BackgroundBarChartRodData(
                                show: true,
                                toY: safeMaxY * 1.2,
                                color: Colors
                                    .transparent, // Background cột tàng hình
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
