import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/network/dio_client.dart';
import '../../../../core/utils/image_utils.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_event.dart';
import '../bloc/profile_state.dart';
import '../../data/models/user_profile_model.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;
  late TextEditingController _emailController;
  String? _selectedGender;
  bool? _isTwoFactorEnabled;

  void _toggleTwoFactor(bool value) async {
    setState(() => _isTwoFactorEnabled = value);
    try {
      final dio = DioClient(onLogout: () {});
      final res = await dio.dio.post('/profile/2fa/toggle');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.data['message'] ?? 'Thao tác 2FA thành công!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isTwoFactorEnabled = !value);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể thay đổi trạng thái 2FA: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }


  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController();
    _lastNameController = TextEditingController();
    _phoneController = TextEditingController();
    _addressController = TextEditingController();
    _emailController = TextEditingController();
    context.read<ProfileBloc>().add(LoadProfileEvent());
  }


  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _emailController.dispose();
    super.dispose();
  }


  void _fillFormData(dynamic profile) {
    // Logic tách tên tương tự Web
    final nameParts = (profile.fullName ?? '').split(' ');
    if (nameParts.length > 1) {
      _firstNameController.text = nameParts.last;
      _lastNameController.text = nameParts.sublist(0, nameParts.length - 1).join(' ');
    } else {
      _firstNameController.text = profile.fullName ?? '';
      _lastNameController.text = '';
    }

    _phoneController.text = profile.phoneNumber ?? '';
    _addressController.text = profile.address ?? '';
    _emailController.text = profile.email ?? '';
    
    final genderMap = {'male': 'Nam', 'female': 'Nữ', 'other': 'Khác'};
    _selectedGender = genderMap[profile.gender] ?? profile.gender;
    _isTwoFactorEnabled ??= profile.isTwoFactorEnabled;
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      if (!mounted) return;
      context.read<ProfileBloc>().add(UpdateAvatarEvent(File(pickedFile.path)));
    }
  }

  void _saveProfile() {
    if (_formKey.currentState!.validate()) {
      final genderMapBack = {'Nam': 'male', 'Nữ': 'female', 'Khác': 'other'};
      final fullName = '${_lastNameController.text} ${_firstNameController.text}'.trim();
      
      final updatedProfile = UserProfileModel(
        id: 0, // Sẽ lấy từ state hoặc BE tự biết
        fullName: fullName,
        email: '', // Không cho sửa
        phoneNumber: _phoneController.text,
        address: _addressController.text,
        gender: genderMapBack[_selectedGender] ?? _selectedGender,
        role: '',
      );

      context.read<ProfileBloc>().add(UpdateProfileInfoEvent(updatedProfile));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text(
          "Hồ sơ cá nhân",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: BlocConsumer<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is ProfileLoaded) {
            _fillFormData(state.profile);
          } else if (state is ProfileUpdated) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Cập nhật hồ sơ thành công')),
            );
          } else if (state is ProfileError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Lỗi: ${state.message}'), backgroundColor: Colors.red),
            );
          } else if (state is AvatarUploaded) {
             ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Cập nhật ảnh đại diện thành công')),
            );
          }
        },
        builder: (context, state) {
          if (state is ProfileLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ProfileError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 60),
                  const SizedBox(height: 16),
                  Text(
                    'Đã có lỗi xảy ra: ${state.message}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.read<ProfileBloc>().add(LoadProfileEvent()),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            );
          }

          dynamic profile;
          if (state is ProfileLoaded) profile = state.profile;
          if (state is ProfileUpdated) profile = state.profile;
          // Fallback if needed

          return Container(
            width: double.infinity,
            height: double.infinity,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFE0E7FF), Color(0xFFF1F5F9), Color(0xFFF5F3FF)],
              ),
            ),
            child: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    // Avatar Section
                    Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Colors.blue, Colors.indigo],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.indigo.withOpacity(0.3),
                                blurRadius: 20,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: CircleAvatar(
                            radius: 65,
                            backgroundColor: Colors.white,
                            backgroundImage: profile?.avatar != null && profile.avatar.isNotEmpty
                                ? NetworkImage(ImageUtils.getFullImageUrl(profile.avatar))
                                : const AssetImage('assets/images/default-avatar.png') as ImageProvider,
                          ),
                        ),
                        GestureDetector(
                          onTap: _pickImage,
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.blue[600],
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 3),
                            ),
                            child: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                          ),
                        ),
                        if (state is AvatarUploading)
                          const Positioned.fill(
                            child: Center(child: CircularProgressIndicator(color: Colors.white)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // Form Section
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.8),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: Colors.white.withOpacity(0.5)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildTextField(
                              controller: _lastNameController,
                              label: 'Họ',
                              hint: 'Nhập họ của bạn',
                              icon: Icons.person_outline,
                            ),
                            const SizedBox(height: 20),
                            _buildTextField(
                              controller: _firstNameController,
                              label: 'Tên',
                              hint: 'Nhập tên của bạn',
                              icon: Icons.person,
                            ),
                            const SizedBox(height: 24),
                            const Text(
                              "Giới tính",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF334155),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: ['Nam', 'Nữ', 'Khác'].map((g) {
                                return _buildGenderOption(g);
                              }).toList(),
                            ),
                            const SizedBox(height: 24),
                            _buildTextField(
                              controller: _emailController,
                              label: 'Email',
                              hint: 'email@example.com',
                              icon: Icons.email_outlined,
                              enabled: false,
                            ),
                            const SizedBox(height: 20),
                            _buildTextField(
                              controller: _phoneController,
                              label: 'SĐT',
                              hint: '0123456789',
                              icon: Icons.phone_android,
                              keyboardType: TextInputType.phone,
                            ),
                            const SizedBox(height: 20),
                            _buildTextField(
                              controller: _addressController,
                              label: 'Địa chỉ',
                              hint: 'Nhập địa chỉ của bạn',
                              icon: Icons.location_on_outlined,
                            ),
                            const SizedBox(height: 24),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.indigo.withOpacity(0.05),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.indigo.withOpacity(0.1)),
                              ),
                              child: SwitchListTile(
                                title: const Text(
                                  "Xác thực hai yếu tố (2FA)",
                                  style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                                ),
                                subtitle: const Text(
                                  "Bật để tăng cường bảo mật cho tài khoản của bạn.",
                                  style: TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                                value: _isTwoFactorEnabled ?? false,
                                activeColor: Colors.indigo,
                                onChanged: _toggleTwoFactor,
                              ),
                            ),
                            const SizedBox(height: 40),
                            SizedBox(
                              width: double.infinity,
                              height: 60,
                              child: ElevatedButton(
                                onPressed: state is ProfileUpdating ? null : _saveProfile,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF4F46E5),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  elevation: 5,

                                  shadowColor: Colors.indigo.withOpacity(0.5),
                                ),
                                child: state is ProfileUpdating
                                    ? const CircularProgressIndicator(color: Colors.white)
                                    : const Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.save),
                                          SizedBox(width: 8),
                                          Text(
                                            'Lưu hồ sơ',
                                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool enabled = true,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF334155),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          enabled: enabled,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 16),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: Colors.indigo[400]),
            filled: true,
            fillColor: enabled ? Colors.white : Colors.grey[100],
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: Colors.grey[200]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: Colors.grey[200]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Colors.indigo, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGenderOption(String label) {
    bool isSelected = _selectedGender == label;
    return GestureDetector(
      onTap: () => setState(() => _selectedGender = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? Colors.indigo[50] : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? Colors.indigo : Colors.grey[200]!,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected ? Colors.indigo : Colors.grey[400],
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.indigo : Colors.grey[600],
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

