import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../domain/entities/monthly_chart_entity.dart';

class InstructorChart extends StatelessWidget {
  final String title;
  final List<MonthlyChartEntity> data;
  final Color lineColor;
  final Color fillColor;
  final bool isExams; // true: vẽ biểu đồ số Đề thi, false: vẽ số Học sinh

  const InstructorChart({
    super.key,
    required this.title,
    required this.data,
    required this.lineColor,
    required this.fillColor,
    required this.isExams,
  });

  @override
  Widget build(BuildContext context) {
    // Nếu chưa có dữ liệu thì hiện khung trống
    if (data.isEmpty) {
      return _buildContainer(
        child: const Center(
          child: Text(
            "Chưa có dữ liệu thống kê",
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    return _buildContainer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: LineChart(
              LineChartData(
                // Tắt lưới nền cho giống giao diện React
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                // Cấu hình các trục
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  leftTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ), // Ẩn cột số bên trái cho gọn
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        // Chuyển index (0, 1, 2...) thành tên tháng (T1, T2...)
                        if (value.toInt() >= 0 && value.toInt() < data.length) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 8.0),
                            child: Text(
                              data[value.toInt()].month,
                              style: const TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                              ),
                            ),
                          );
                        }
                        return const Text('');
                      },
                    ),
                  ),
                ),
                // Cấu hình đường Line
                lineBarsData: [
                  LineChartBarData(
                    // Chuyển mảng MonthlyChartEntity thành các điểm toạ độ (X, Y)
                    spots: data.asMap().entries.map((entry) {
                      final int index = entry.key;
                      final int value = isExams
                          ? entry.value.examsCreated
                          : entry.value.studentsParticipated;
                      return FlSpot(index.toDouble(), value.toDouble());
                    }).toList(),
                    isCurved: true, // Đường cong mượt
                    color: lineColor,
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(
                      show: false,
                    ), // Tắt các chấm tròn ở mỗi điểm
                    belowBarData: BarAreaData(
                      show: true,
                      color: fillColor.withOpacity(
                        0.2,
                      ), // Đổ màu nhạt ở dưới đường line
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContainer({required Widget child}) {
    return Container(
      height: 250,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}
