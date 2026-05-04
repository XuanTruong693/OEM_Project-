import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class LandingPage extends StatefulWidget {
  final bool showGradientBackground;

  const LandingPage({super.key, this.showGradientBackground = true});

  @override
  State<LandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends State<LandingPage> {
  bool menuOpen = false;

  // 1. TẠO CÁC TỌA ĐỘ (GlobalKey) ĐỂ CUỘN TRANG
  final GlobalKey _homeKey = GlobalKey();
  final GlobalKey _aboutKey = GlobalKey();
  final GlobalKey _featuresKey = GlobalKey();
  final GlobalKey _newsKey = GlobalKey();
  final GlobalKey _contactKey = GlobalKey();

  void toggleMenu() {
    setState(() {
      menuOpen = !menuOpen;
    });
  }

  // 2. HÀM CUỘN TỰ ĐỘNG ĐẾN SECTION
  void handleNavClick(GlobalKey key) {
    setState(() => menuOpen = false); // Đóng menu trước

    // Đợi menu đóng xong (300ms) rồi mới cuộn cho mượt
    Future.delayed(const Duration(milliseconds: 300), () {
      if (key.currentContext != null) {
        Scrollable.ensureVisible(
          key.currentContext!,
          duration: const Duration(milliseconds: 800), // Thời gian cuộn
          curve: Curves.easeInOutCubic, // Hiệu ứng cuộn mượt mà
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          /// 1. BACKGROUND NỀN
          if (widget.showGradientBackground)
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFFC3EDFF),
                    Color(0xFFE1EDFD),
                    Color(0xFFFFECFA),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          if (!widget.showGradientBackground) Container(color: Colors.white),

          /// 2. MAIN CONTENT (NAVBAR + BODY CÓ THỂ CUỘN)
          SafeArea(
            child: Column(
              children: [
                /// NAVBAR
                _buildNavBar(context),

                /// BODY
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                        // Gắn tọa độ (key) vào từng Section
                        Container(key: _homeKey, child: const _HeroSection()),
                        _SectionWrapper(
                          key: _aboutKey,
                          id: "about",
                          child: const _AboutUsSection(),
                        ),
                        _SectionWrapper(
                          key: _featuresKey,
                          id: "features",
                          child: const _FeaturesSection(),
                        ),
                        _SectionWrapper(
                          key: _newsKey,
                          id: "news",
                          child: const _NewsSection(),
                        ),
                        _SectionWrapper(
                          key: _contactKey,
                          id: "contact",
                          child: const _ContactSection(),
                        ),
                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          /// 3. MÀN ĐEN MỜ KHI MỞ MENU
          if (menuOpen)
            Positioned.fill(
              child: GestureDetector(
                onTap: toggleMenu,
                child: Container(color: Colors.black.withOpacity(0.2)),
              ),
            ),

          /// 4. MENU ĐIỀU HƯỚNG TRƯỢT TỪ TRÊN XUỐNG
          _buildMobileMenu(),
        ],
      ),
    );
  }

  Widget _buildNavBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: () => handleNavClick(_homeKey),
            child: SizedBox(
              width: 140,
              height: 55,
              child: Image.asset(
                "assets/images/Logo.png",
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) =>
                    const Icon(Icons.image, color: Colors.grey),
              ),
            ),
          ),
          IconButton(
            icon: Icon(
              menuOpen ? Icons.close : Icons.menu,
              color: const Color(0xFF003CFF),
              size: 28,
            ),
            onPressed: toggleMenu,
          ),
        ],
      ),
    );
  }

  Widget _buildMobileMenu() {
    final screenHeight = MediaQuery.of(context).size.height;

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutBack,
      top: menuOpen ? 0 : -screenHeight,
      left: 0,
      right: 0,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF023E8A).withOpacity(0.15),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: SafeArea(
          bottom: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(
                  left: 24,
                  right: 16,
                  top: 16,
                  bottom: 8,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      "Danh mục",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF023E8A),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.cancel,
                        color: Colors.grey,
                        size: 28,
                      ),
                      onPressed: toggleMenu,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 16, left: 16, right: 16),
                child: Column(
                  children:
                      [
                            {
                              "label": "Trang chủ",
                              "key": _homeKey,
                              "icon": Icons.home_rounded,
                            },
                            {
                              "label": "Về chúng tôi",
                              "key": _aboutKey,
                              "icon": Icons.info_rounded,
                            },
                            {
                              "label": "Tính năng",
                              "key": _featuresKey,
                              "icon": Icons.star_rounded,
                            },
                            {
                              "label": "Tin tức",
                              "key": _newsKey,
                              "icon": Icons.article_rounded,
                            },
                            {
                              "label": "Liên hệ",
                              "key": _contactKey,
                              "icon": Icons.phone_rounded,
                            },
                          ]
                          .map(
                            (item) => Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: () =>
                                    handleNavClick(item["key"] as GlobalKey),
                                borderRadius: BorderRadius.circular(16),
                                splashColor: const Color(
                                  0xFF003CFF,
                                ).withOpacity(0.1),
                                highlightColor: const Color(
                                  0xFF003CFF,
                                ).withOpacity(0.05),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 16,
                                    horizontal: 16,
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE1EDFD),
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                        child: Icon(
                                          item["icon"] as IconData,
                                          color: const Color(0xFF005FBD),
                                          size: 20,
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      Text(
                                        item["label"] as String,
                                        style: const TextStyle(
                                          color: Color(0xFF023E8A),
                                          fontSize: 17,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const Spacer(),
                                      const Icon(
                                        Icons.chevron_right_rounded,
                                        color: Colors.grey,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                ),
              ),

              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Divider(color: Colors.black12, height: 1),
              ),
              Padding(
                padding: const EdgeInsets.all(24),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          toggleMenu(); // Đóng menu trước khi chuyển trang
                          context.go('/role');
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF005FBD),
                          side: const BorderSide(
                            color: Color(0xFF005FBD),
                            width: 2,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          "Đăng Nhập",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          toggleMenu(); // Đóng menu trước khi chuyển trang
                          context.go('/role');
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF005FBD),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                        child: const Text(
                          "Đăng Ký",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ==========================================
/// COMPONENT CỤC BỘ (CÁC SECTION)
/// ==========================================

Widget _buildBulletText(String text, {Color textColor = Colors.black87}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 8.0),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "• ",
          style: TextStyle(fontSize: 18, color: textColor, height: 1.2),
        ),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 15, color: textColor, height: 1.5),
          ),
        ),
      ],
    ),
  );
}

// 1. HERO SECTION
class _HeroSection extends StatelessWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        bool isDesktop = constraints.maxWidth > 800;

        List<Widget> children = [
          Expanded(
            flex: isDesktop ? 1 : 0,
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: TweenAnimationBuilder(
                tween: Tween<double>(begin: 0, end: 1),
                duration: const Duration(milliseconds: 800),
                builder: (context, value, child) {
                  return Transform.translate(
                    offset: Offset(-50 * (1 - value), 0),
                    child: Opacity(opacity: value, child: child),
                  );
                },
                child: Column(
                  crossAxisAlignment: isDesktop
                      ? CrossAxisAlignment.start
                      : CrossAxisAlignment.center,
                  children: [
                    Transform.rotate(
                      angle: -0.1,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                        margin: const EdgeInsets.only(bottom: 24, top: 40),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.8),
                          border: Border.all(
                            color: const Color(0xFF005FBD),
                            width: 3,
                          ),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.1),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Text(
                          "OEM Mini",
                          style: TextStyle(
                            color: Color(0xFF0097E9),
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                    Text(
                      "Hệ thống đắc lực hỗ trợ",
                      textAlign: isDesktop ? TextAlign.left : TextAlign.center,
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF023E8A),
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      "thi trực tuyến hiệu quả",
                      textAlign: isDesktop ? TextAlign.left : TextAlign.center,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        color: Color(0xCC00C3FF),
                      ),
                    ),

                    const SizedBox(height: 32),
                    Row(
                      mainAxisAlignment: isDesktop
                          ? MainAxisAlignment.start
                          : MainAxisAlignment.center,
                      children: [
                        // Nút Đăng ký (Làm nổi bật với nền xanh)
                        ElevatedButton(
                          onPressed: () => context.go('/role'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF005FBD),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 14,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 4,
                          ),
                          child: const Text(
                            "Đăng Ký Ngay",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        // Nút Đăng nhập (Viền xanh, nền trắng)
                        OutlinedButton(
                          onPressed: () => context.go('/role'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF005FBD),
                            side: const BorderSide(
                              color: Color(0xFF005FBD),
                              width: 2,
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 14,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            "Đăng Nhập",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            flex: isDesktop ? 1 : 0,
            child: const Padding(
              padding: EdgeInsets.all(24.0),
              child: _FloatingImage(),
            ),
          ),
        ];

        return isDesktop
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: children,
              )
            : Column(children: children);
      },
    );
  }
}

// 2. ABOUT US SECTION
class _AboutUsSection extends StatelessWidget {
  const _AboutUsSection();

  final List<String> aboutPoints = const [
    "Tích hợp AI/NLP hỗ trợ chấm điểm tự luận thông minh, đảm bảo tính công bằng và minh bạch.",
    "Tạo đề thi nhanh chóng từ file Excel, hỗ trợ tự động phân loại câu hỏi theo mức độ.",
    "Chấm điểm tự động nhanh chóng, hỗ trợ giáo viên tiết kiệm thời gian đáng kể.",
    "Quản lý khóa học, ngân lượng và kết quả thi trên một nền tảng duy nhất, dễ sử dụng.",
    "Thống kê, báo cáo kết quả toàn diện, hỗ trợ giảng viên đánh giá chính xác năng lực học viên.",
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        children: [
          const Text(
            "Về chúng tôi",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E3A8A),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFDBEAFE), Color(0xFFFCE7F3)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: const TextSpan(
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.black87,
                      height: 1.5,
                    ),
                    children: [
                      TextSpan(
                        text:
                            "Với quy trình phát triển bài bản, áp dụng công nghệ tiên tiến vào giao diện thân thiện, ",
                      ),
                      TextSpan(
                        text: "OEM",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text:
                            " đã giúp nhiều giảng viên và trung tâm đào tạo tổ chức các kỳ thi trực tuyến hiệu quả với các ưu điểm sau:",
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ...aboutPoints.map((text) => _buildBulletText(text)),
                const SizedBox(height: 16),
                RichText(
                  text: const TextSpan(
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.black87,
                      height: 1.5,
                    ),
                    children: [
                      TextSpan(
                        text:
                            "Bên cạnh việc cung cấp các phương pháp học tập hiệu quả, ",
                      ),
                      TextSpan(
                        text: "OEM",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text:
                            " còn mang lại sự tiện lợi trong việc tổ chức các kỳ thi trực tuyến.",
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// 3. FEATURES SECTION
class _FeaturesSection extends StatelessWidget {
  const _FeaturesSection();

  final List<Map<String, dynamic>> features = const [
    {
      "icon": "assets/icons/UI Image/8194264.png",
      "title": "Tạo đề thi nhanh",
      "desc": [
        "Tải lên file Excel chứa câu hỏi, hệ thống tự động phân loại MCQ và Essay.",
        "Nhận diện và sắp xếp câu hỏi theo dạng trắc nghiệm và tự luận.",
        "Chỉnh sửa câu hỏi ngay sau khi import.",
        "Kiểm soát số lượng câu hỏi tối đa trên mỗi đề.",
      ],
    },
    {
      "icon": "assets/icons/UI Image/12.png",
      "title": "Chấm điểm tự động",
      "desc": [
        "Trắc nghiệm chấm ngay lập tức, bài tự luận AI/NLP gợi ý điểm số.",
        "Chấm điểm MCQ dựa trên đáp án đúng đã đánh dấu.",
        "Giảng viên xem lại và điều chỉnh điểm AI trước khi công bố.",
        "Ghi nhận lịch sử điểm và thao tác chỉnh sửa.",
      ],
    },
    {
      "icon": "assets/icons/UI Image/123.png",
      "title": "Minh bạch & công bằng",
      "desc": [
        "Xem điểm MCQ ngay sau nộp bài; tự luận do giảng viên xác nhận.",
        "Xuất điểm và thống kê thành file CSV/Excel.",
        "Xem tổng quan kết quả của tất cả học sinh.",
        "Điểm tự luận chỉ công bố sau khi duyệt.",
      ],
    },
    {
      "icon": "assets/icons/UI Image/124.png",
      "title": "Bảo mật dữ liệu",
      "desc": [
        "Sử dụng JWT, bcrypt và phân quyền role-based để bảo vệ dữ liệu.",
        "Mật khẩu được lưu an toàn.",
        "Validate input chống SQL Injection/XSS, lưu nhật ký hoạt động.",
        "Sao lưu thường xuyên tránh mất mát dữ liệu.",
      ],
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        children: [
          const Text(
            "Tính năng nổi bật",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E3A8A),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, constraints) {
              int crossAxisCount = constraints.maxWidth > 900
                  ? 4
                  : (constraints.maxWidth > 600 ? 2 : 1);
              double itemWidth =
                  (constraints.maxWidth - (crossAxisCount - 1) * 16) /
                  crossAxisCount;

              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: features.map((feature) {
                  return Container(
                    width: itemWidth,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FBFF),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Center(
                          child: Column(
                            children: [
                              Image.asset(
                                feature["icon"],
                                width: 48,
                                height: 48,
                                errorBuilder: (context, error, stackTrace) =>
                                    const Icon(
                                      Icons.star,
                                      size: 48,
                                      color: Colors.blue,
                                    ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                feature["title"],
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 18,
                                  color: Color(0xFF180EFF),
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        ...(feature["desc"] as List<String>).map(
                          (point) => _buildBulletText(
                            point,
                            textColor: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

// 4. NEWS SECTION
class _NewsSection extends StatelessWidget {
  const _NewsSection();

  final List<Map<String, String>> newsList = const [
    {
      "title": "Kỷ nguyên chuyển đổi số trong giáo dục",
      "date": "04/03/2026",
      "description":
          "Trong kỷ nguyên số hóa, giáo dục đang trải qua những thay đổi mạnh mẽ. Công nghệ thông tin đã trở thành một công cụ đắc lực hỗ trợ việc dạy và học...",
    },
    {
      "title": "Ứng dụng Trí tuệ nhân tạo (AI) trong tạo đề thi",
      "date": "04/03/2026",
      "description":
          "Hệ thống OEM ra đời nhằm đáp ứng nhu cầu đó, mang đến cho người dùng những trải nghiệm học tập và thi cử tốt nhất bằng AI...",
    },
    {
      "title": "Đổi mới phương pháp kiểm tra đánh giá",
      "date": "04/03/2026",
      "description":
          "Các phương pháp KTĐG truyền thống đang dần được thay thế bởi các phương pháp hiện đại, chú trọng đánh giá năng lực thực chất của người học...",
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        children: [
          const Text(
            "Tin tức",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E3A8A),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: const BoxDecoration(
                    color: Colors.blue,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(24),
                      topRight: Radius.circular(24),
                    ),
                  ),
                  child: const Text(
                    "TIN TỨC NỔI BẬT",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: newsList.map((news) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(color: Colors.grey.shade200),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              news["title"]!,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF180EFF),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              news["date"]!,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Colors.grey,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              news["description"]!,
                              style: const TextStyle(
                                fontSize: 15,
                                color: Colors.black87,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// 5. CONTACT SECTION
class _ContactSection extends StatelessWidget {
  const _ContactSection();

  final List<Map<String, String>> contacts = const [
    {
      "icon": "assets/icons/UI Image/gps.png",
      "text": "120 Hoàng Minh Thảo, quận Liên Chiểu, thành phố Đà Nẵng",
    },
    {"icon": "assets/icons/UI Image/phone.png", "text": "0971893750"},
    {
      "icon": "assets/icons/UI Image/mail1.png",
      "text": "truongkt693@gmail.com",
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        children: [
          const Text(
            "Liên hệ",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E3A8A),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFDBEAFE), Color(0xFFFCE7F3)],
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                bool isDesktop = constraints.maxWidth > 600;
                List<Widget> content = [
                  Expanded(
                    flex: isDesktop ? 2 : 0,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: contacts.map((item) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Row(
                            children: [
                              Image.asset(
                                item["icon"]!,
                                width: 40,
                                height: 40,
                                errorBuilder: (context, error, stackTrace) =>
                                    const Icon(Icons.info, color: Colors.blue),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Text(
                                  item["text"]!,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    color: Colors.black87,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  if (isDesktop) const SizedBox(width: 32),
                  Expanded(
                    flex: isDesktop ? 1 : 0,
                    child: Center(
                      child: Image.asset(
                        "assets/images/Logo.png",
                        height: 100,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(
                              Icons.image,
                              size: 80,
                              color: Colors.grey,
                            ),
                      ),
                    ),
                  ),
                ];

                return isDesktop
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: content,
                      )
                    : Column(children: content);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// 6. HELPER CLASSES (Animation logic & Section Wrapper)
class _SectionWrapper extends StatelessWidget {
  final String id;
  final Widget child;

  // Thêm super.key để nhận GlobalKey truyền từ ngoài vào
  const _SectionWrapper({super.key, required this.id, required this.child});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 800),
      builder: (context, value, childWidget) {
        return Transform.translate(
          offset: Offset(0, 100 * (1 - value)),
          child: Opacity(opacity: value, child: childWidget),
        );
      },
      child: child,
    );
  }
}

class _FloatingImage extends StatefulWidget {
  const _FloatingImage();

  @override
  State<_FloatingImage> createState() => _FloatingImageState();
}

class _FloatingImageState extends State<_FloatingImage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _animation = Tween<double>(
      begin: 0,
      end: -20,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 800),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.scale(scale: 0.8 + (0.2 * value), child: child),
        );
      },
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, _animation.value),
            child: child,
          );
        },
        child: Image.asset(
          "assets/images/process.png",
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) => const SizedBox(
            height: 300,
            child: Center(
              child: Text(
                "Hình minh họa 3D",
                style: TextStyle(color: Colors.blueGrey),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
