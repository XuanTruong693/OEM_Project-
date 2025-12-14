import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Edit2, Trash2, Eye, UserPlus,
    ChevronLeft, ChevronRight, X, Save, Check, AlertTriangle
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const UserManagement = () => {
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [roleFilter, setRoleFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [selectedUser, setSelectedUser] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Fetch users
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit,
                ...(roleFilter !== 'all' && { role: roleFilter }),
                ...(searchTerm && { search: searchTerm })
            });

            const response = await axiosClient.get(`/admin/users?${params}`);

            if (response.data.success) {
                setUsers(response.data.users);
                setTotal(response.data.total);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setMessage({ type: 'error', text: 'Lỗi khi tải danh sách người dùng' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page, roleFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== '') {
                setPage(1);
                fetchUsers();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // View user details
    const handleView = async (userId) => {
        try {
            const response = await axiosClient.get(`/admin/users/${userId}`);
            if (response.data.success) {
                setSelectedUser(response.data.user);
                setShowViewModal(true);
            }
        } catch (error) {
            console.error('Error fetching user:', error);
        }
    };

    // Edit user
    const handleEdit = (user) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name || '',
            email: user.email || '',
            role: user.role || 'student',
            phone_number: user.phone_number || '',
            address: user.address || '',
            gender: user.gender || ''
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.put(`/admin/users/${selectedUser.id}`, editForm);

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Cập nhật thành công!' });
                setShowEditModal(false);
                fetchUsers();
            }
        } catch (error) {
            console.error('Error updating user:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Lỗi khi cập nhật' });
        } finally {
            setSaving(false);
        }
    };

    // Delete user
    const handleDelete = (user) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            setSaving(true);
            const response = await axiosClient.delete(`/admin/users/${selectedUser.id}`);

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Xóa người dùng thành công!' });
                setShowDeleteModal(false);
                fetchUsers();
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Lỗi khi xóa' });
        } finally {
            setSaving(false);
        }
    };

    // Clear message after 3 seconds
    useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const totalPages = Math.ceil(total / limit);

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'admin': return 'bg-red-600/20 text-red-400 border border-red-600/30';
            case 'instructor': return 'bg-purple-600/20 text-purple-400 border border-purple-600/30';
            case 'student': return 'bg-blue-600/20 text-blue-400 border border-blue-600/30';
            default: return 'bg-gray-600/20 text-gray-400';
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-900">
            <AdminSidebar activeTab="users" />

            <main className="flex-1 p-8 overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">{t('userManagement')}</h1>
                        <p className="text-gray-400 mt-1">{t('userManagement')}</p>
                    </div>
                </div>

                {/* Message Toast */}
                {message.text && (
                    <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                        } text-white flex items-center gap-2`}>
                        {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                        {message.text}
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('searchByNameOrEmail')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">{t('allRoles')}</option>
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                {/* Users Table */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('fullName')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('email')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('role')}</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('createdAt')}</th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                                        {t('loading')}
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                                        {t('noData')}
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-300">#{user.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                                                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-white font-medium">{user.full_name || t('notUpdated')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-300">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {new Date(user.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleView(user.id)}
                                                    className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-600/10 rounded-lg transition-colors"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {user.role !== 'admin' && (
                                                    <button
                                                        onClick={() => handleDelete(user)}
                                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                            <span className="text-sm text-gray-400">
                                {t('showing')} {(page - 1) * limit + 1} - {Math.min(page * limit, total)} {t('of')} {total} {t('users')}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="text-white">{t('page')} {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* View Modal */}
                {showViewModal && selectedUser && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg mx-4">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white">Chi tiết người dùng</h2>
                                <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl text-white font-bold">
                                        {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-white">{selectedUser.full_name || 'Chưa cập nhật'}</h3>
                                        <p className="text-gray-400">{selectedUser.email}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Role</label>
                                        <p className="text-white mt-1">{selectedUser.role}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Giới tính</label>
                                        <p className="text-white mt-1">{selectedUser.gender || 'Chưa cập nhật'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Số điện thoại</label>
                                        <p className="text-white mt-1">{selectedUser.phone_number || 'Chưa cập nhật'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Ngày tạo</label>
                                        <p className="text-white mt-1">{new Date(selectedUser.created_at).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Địa chỉ</label>
                                    <p className="text-white mt-1">{selectedUser.address || 'Chưa cập nhật'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && selectedUser && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg mx-4">
                            <div className="flex justify-between items-center p-6 border-b border-gray-700">
                                <h2 className="text-xl font-semibold text-white">Chỉnh sửa người dùng</h2>
                                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Họ và tên</label>
                                    <input
                                        type="text"
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Role</label>
                                    <select
                                        value={editForm.role}
                                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                        disabled={selectedUser.role === 'admin'}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                    >
                                        <option value="student">Student</option>
                                        <option value="instructor">Instructor</option>
                                    </select>
                                    {selectedUser.role === 'admin' && (
                                        <p className="text-xs text-yellow-400 mt-1">Không thể thay đổi role của Admin</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Số điện thoại</label>
                                        <input
                                            type="text"
                                            value={editForm.phone_number}
                                            onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Giới tính</label>
                                        <select
                                            value={editForm.gender}
                                            onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="">Chưa chọn</option>
                                            <option value="male">Nam</option>
                                            <option value="female">Nữ</option>
                                            <option value="other">Khác</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Địa chỉ</label>
                                    <input
                                        type="text"
                                        value={editForm.address}
                                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && selectedUser && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md mx-4">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="text-red-400" size={32} />
                                </div>
                                <h2 className="text-xl font-semibold text-white mb-2">Xác nhận xóa</h2>
                                <p className="text-gray-400 mb-6">
                                    Bạn có chắc chắn muốn xóa người dùng <span className="text-white font-medium">{selectedUser.email}</span>?
                                    Hành động này không thể hoàn tác.
                                </p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        disabled={saving}
                                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Đang xóa...' : 'Xóa'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default UserManagement;
