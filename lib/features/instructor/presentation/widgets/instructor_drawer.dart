import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/storage/secure_storage_helper.dart';

class InstructorDrawer extends StatelessWidget {
  final String currentRoute;

  const InstructorDrawer({super.key, required this.currentRoute});

  Widget _buildMenuItem({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String route,
    bool isDanger = false,
  }) {
    final isActive = currentRoute == route;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isActive ? Colors.blue.withOpacity(0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(
            color: isActive ? Colors.blue : Colors.transparent,
            width: 4,
          ),
        ),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: isActive
              ? Colors.blue
              : (isDanger ? Colors.red : Colors.grey.shade600),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
            color: isActive
                ? Colors.blue
                : (isDanger ? Colors.red : Colors.grey.shade700),
          ),
        ),
        onTap: () {
          Navigator.pop(context);
          if (currentRoute != route) {
            context.push(route);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFE8F5FF), Color(0xFFCAEAFF)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Logo
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Image.asset(
                  'assets/images/sidebar_logo.png', // Logo dành riêng cho sidebar
                  height: 60,
                  errorBuilder: (context, error, stackTrace) => const Text(
                    "LOGO",
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const Divider(color: Colors.white54),

              // Danh sách Menu
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _buildMenuItem(
                      context: context,
                      icon: Icons.dashboard_outlined,
                      title: "Bảng điều khiển",
                      route: '/instructor-dashboard',
                    ),

                    // --- MENU XỔ XUỐNG (DROPDOWN) ---
                    Container(
                      margin: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Theme(
                        data: Theme.of(
                          context,
                        ).copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          leading: Icon(
                            Icons.folder_outlined,
                            color: Colors.grey.shade600,
                          ),
                          title: Text(
                            "Tài nguyên",
                            style: TextStyle(
                              fontWeight: FontWeight.w500,
                              color: Colors.grey.shade700,
                            ),
                          ),
                          iconColor: Colors.blue,
                          childrenPadding: const EdgeInsets.only(left: 20),
                          children: [
                            // Đã cập nhật 2 mục con theo file React mới
                            _buildMenuItem(
                              context: context,
                              icon: Icons.meeting_room_outlined,
                              title: "Quản lý phòng thi",
                              route: '/instructor/rooms',
                            ),
                            _buildMenuItem(
                              context: context,
                              icon: Icons.edit_note_outlined,
                              title: "Mở phòng thi",
                              route: '/open-exam',
                            ),
                          ],
                        ),
                      ),
                    ),

                    // --- CÁC MENU ĐỘC LẬP BÊN DƯỚI ---
                    _buildMenuItem(
                      context: context,
                      icon: Icons.description_outlined,
                      title: "Ngân hàng đề",
                      route: '/exam-bank',
                    ),
                    _buildMenuItem(
                      context: context,
                      icon: Icons.assignment_outlined,
                      title: "Assign Exam",
                      route: '/assign-exam',
                    ),
                    _buildMenuItem(
                      context: context,
                      icon: Icons.assessment_outlined,
                      title: "Kết quả",
                      route: '/instructor/exam-results',
                    ),
                  ],
                ),
              ),

              // Cài đặt & Đăng xuất
              const Divider(color: Colors.white54),
              _buildMenuItem(
                context: context,
                icon: Icons.settings_outlined,
                title: "Cài đặt",
                route: '/setting',
              ),

              ListTile(
                leading: const Icon(Icons.logout, color: Colors.red),
                title: const Text(
                  "Đăng xuất",
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 28),
                onTap: () async {
                  // 1. Xóa sạch Token dưới máy
                  await SecureStorageHelper.clearAll();
                  if (context.mounted) {
                    context.go('/role');
                  }
                },
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }
}
