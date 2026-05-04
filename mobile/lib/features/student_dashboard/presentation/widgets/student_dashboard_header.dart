import 'package:flutter/material.dart';

class StudentDashboardHeader extends StatelessWidget {
  final String userName;
  final String avatarUrl;
  final VoidCallback onLogout;
  final VoidCallback onProfileTap;

  const StudentDashboardHeader({
    super.key,
    required this.userName,
    required this.avatarUrl,
    required this.onLogout,
    required this.onProfileTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9), // Kính mờ
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Logo & Title
            Row(
              children: [
                Image.asset(
                  'assets/images/app_logo.png',
                  height: 32,
                  width: 32,
                  errorBuilder: (context, error, stackTrace) =>
                      const Icon(Icons.school, color: Colors.blue),
                ),
                const SizedBox(width: 8),
                const Text(
                  'Student',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF334155),
                  ),
                ),
              ],
            ),
            // User & Logout
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Flexible(
                    child: GestureDetector(
                      onTap: onProfileTap,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: Colors.blue.shade100,
                            backgroundImage: (avatarUrl.isNotEmpty &&
                                    avatarUrl.startsWith('http'))
                                ? NetworkImage(avatarUrl)
                                : null,
                            child: (avatarUrl.isEmpty ||
                                    !avatarUrl.startsWith('http'))
                                ? const Icon(
                                    Icons.person,
                                    size: 20,
                                    color: Colors.blue,
                                  )
                                : null,
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              userName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1E293B),
                                fontSize: 13,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: onLogout,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      side: BorderSide(color: Colors.grey.shade300),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Đăng xuất',
                      style: TextStyle(color: Color(0xFF334155), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
