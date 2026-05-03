import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_rooms_bloc.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_rooms_event.dart';
import 'package:mobile/features/instructor_rooms/presentation/bloc/instructor_rooms_state.dart';
import 'package:mobile/features/instructor_rooms/domain/entities/exam_room_entity.dart';

class InstructorRoomsPage extends StatefulWidget {
  const InstructorRoomsPage({super.key});

  @override
  State<InstructorRoomsPage> createState() => _InstructorRoomsPageState();
}

class _InstructorRoomsPageState extends State<InstructorRoomsPage> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<InstructorRoomsBloc>().add(LoadActiveRoomsEvent());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text("Quản lý phòng thi", 
          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.blue),
            onPressed: () => context.read<InstructorRoomsBloc>().add(LoadActiveRoomsEvent()),
          ),
        ],
      ),
      body: BlocBuilder<InstructorRoomsBloc, InstructorRoomsState>(
        builder: (context, state) {
          if (state is InstructorRoomsLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is InstructorRoomsError) {
            return Center(child: Text(state.message, style: const TextStyle(color: Colors.red)));
          }

          if (state is InstructorRoomsLoaded) {
            return Column(
              children: [
                _buildSummaryStats(state),
                _buildSearchBox(),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () async {
                      context.read<InstructorRoomsBloc>().add(LoadActiveRoomsEvent());
                    },
                    child: state.filteredRooms.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(
                                height: MediaQuery.of(context).size.height * 0.5,
                                child: _buildEmptyState(),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(16),
                            itemCount: state.filteredRooms.length,
                            itemBuilder: (context, index) {
                              return _buildRoomCard(state.filteredRooms[index]);
                            },
                          ),
                  ),
                ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildSummaryStats(InstructorRoomsLoaded state) {
    final totalStudents = state.allRooms.fold<int>(0, (sum, room) => sum + room.activeStudents);
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        children: [
          Expanded(child: _statCard("Phòng đang mở", "${state.allRooms.length}", Colors.blue)),
          const SizedBox(width: 12),
          Expanded(child: _statCard("Tổng sinh viên", "$totalStudents", Colors.green)),
        ],
      ),
    );
  }

  Widget _statCard(String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: color.withOpacity(0.8), fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _buildSearchBox() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: TextField(
        controller: _searchController,
        onChanged: (v) => context.read<InstructorRoomsBloc>().add(SearchRoomsEvent(v)),
        decoration: InputDecoration(
          hintText: "Tìm tên bài thi hoặc mã phòng...",
          prefixIcon: const Icon(Icons.search, color: Colors.grey),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
        ),
      ),
    );
  }

  Widget _buildRoomCard(ExamRoomEntity room) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4))],
        border: Border.all(color: Colors.grey[100]!),
      ),
      child: InkWell(
        onTap: () => context.push('/instructor/rooms/${room.id}'),
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(8)),
                        child: Text("Mã: ${room.examRoomCode}", 
                          style: TextStyle(color: Colors.blue[700], fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                      Row(
                        children: [
                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                          const SizedBox(width: 6),
                          const Text("LIVE", style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(room.title ?? '', 
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.black87),
                    maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _iconInfo(Icons.people_outline, "${room.activeStudents} sinh viên"),
                      const SizedBox(width: 20),
                      _iconInfo(Icons.timer_outlined, "${room.durationMinutes} phút"),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24))),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => context.push('/instructor/rooms/${room.id}'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue[600],
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text("Can thiệp ngay", style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    onPressed: () => _showCloseRoomDialog(room),
                    icon: const Icon(Icons.cancel_outlined, color: Colors.red),
                    style: IconButton.styleFrom(backgroundColor: Colors.red[50], shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _iconInfo(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey[400]),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.door_front_door_outlined, size: 64, color: Colors.grey[200]),
          const SizedBox(height: 16),
          Text("Không tìm thấy phòng thi nào đang hoạt động.", style: TextStyle(color: Colors.grey[400])),
        ],
      ),
    );
  }

  void _showCloseRoomDialog(ExamRoomEntity room) {
    final pageContext = context;
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text("Đóng phòng thi"),
        content: const Text("Bạn có chắc chắn muốn đóng phòng thi này? Tất cả sinh viên đang thi sẽ bị buộc dừng lại ngay lập tức."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text("Hủy")),
          TextButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              
              ScaffoldMessenger.of(pageContext).showSnackBar(
                const SnackBar(content: Text("Đang đóng phòng thi..."), duration: Duration(seconds: 1)),
              );

              try {
                final ds = pageContext.read<InstructorRoomsBloc>().dataSource;
                await ds.closeRoom(room.id);

                if (pageContext.mounted) {
                  ScaffoldMessenger.of(pageContext).showSnackBar(
                    const SnackBar(
                      content: Text("Đã đóng phòng thi thành công!"),
                      backgroundColor: Colors.green,
                    ),
                  );
                  pageContext.read<InstructorRoomsBloc>().add(LoadActiveRoomsEvent());
                }
              } catch (e) {
                if (pageContext.mounted) {
                  ScaffoldMessenger.of(pageContext).showSnackBar(
                    SnackBar(
                      content: Text("Không thể đóng phòng: $e"),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text("Đóng ngay", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
