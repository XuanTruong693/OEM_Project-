import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  Home, Users, BookOpen, FileText, Award, 
  Database, Settings, TrendingUp, User 
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalInstructors: 0,
    totalExamsUploaded: 0,
    totalExams: 0,
    publishedRooms: 0,
    studentGrowth: 0,
    instructorGrowth: 0,
    examGrowth: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch dashboard statistics from API
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await axiosClient.get('/admin/dashboard');
        
        if (response.data && response.data.stats) {
          setStats(response.data.stats);
        }
        
        // Fetch user growth data
        if (response.data && response.data.userGrowth) {
          setUserGrowthData(response.data.userGrowth);
        }
        
        // Fetch recent users
        if (response.data && response.data.recentUsers) {
          setRecentUsers(response.data.recentUsers);
        }
        
        // Fetch performance data
        if (response.data && response.data.performanceData) {
          setPerformanceData(response.data.performanceData);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // Fallback to default values if API fails
        setStats({
          totalStudents: 245,
          totalInstructors: 35,
          totalExamsUploaded: 120,
          totalExams: 0,
          publishedRooms: 0,
          studentGrowth: 18,
          instructorGrowth: 5,
          examGrowth: 10
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const [userGrowthData, setUserGrowthData] = useState([
    { month: 'Jan', users: 0, value: 0 },
    { month: 'Feb', users: 0, value: 0 },
    { month: 'Mar', users: 0, value: 0 },
    { month: 'Apr', users: 0, value: 0 },
    { month: 'May', users: 0, value: 0 },
    { month: 'Jun', users: 0, value: 0 },
    { month: 'Jul', users: 0, value: 0 },
    { month: 'Aug', users: 0, value: 0 },
    { month: 'Sep', users: 0, value: 0 },
    { month: 'Oct', users: 0, value: 0 },
    { month: 'Nov', users: 0, value: 0 },
    { month: 'Dec', users: 0, value: 0 }
  ]);

  const [performanceData, setPerformanceData] = useState([
    { exam: 'Exam 1', score: 65 },
    { exam: 'Exam 7', score: 75 },
    { exam: 'Exam 4', score: 82 },
    { exam: 'Exam 6', score: 88 },
    { exam: 'Final', score: 92 }
  ]);

  const [recentUsers, setRecentUsers] = useState([
    { id: 1, name: "Sms B'ils", initial: 'S', color: 'bg-blue-500' },
    { id: 2, name: 'Bonelle tame', initial: 'B', color: 'bg-purple-500' }
  ]);

  const navItems = [
    { icon: Home, label: 'Dashboard', active: true },
    { icon: Users, label: 'User Management', active: false },
    { icon: BookOpen, label: 'Exam Management', active: false },
    { icon: FileText, label: 'Exam Overview', active: false },
    { icon: Award, label: 'Results', active: false },
    { icon: Database, label: 'System Logs', active: false },
    { icon: Settings, label: 'Settings', active: false }
  ];

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="p-6 pb-8">
          <h2 className="text-xl font-semibold text-white">OEM Mini</h2>
        </div>
        
        <nav className="flex flex-col">
          {navItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className={`flex items-center gap-3 px-6 py-4 text-sm transition-all ${
                item.active
                  ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Spans 2 columns */}
          <div className="xl:col-span-2 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Students */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-400 mb-3">Total Students</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {loading ? '...' : stats.totalStudents.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <TrendingUp size={14} />
                  <span>+{loading ? '...' : stats.studentGrowth}% since last month</span>
                </div>
              </div>

              {/* Total Instructors */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-400 mb-3">Total Instructors</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {loading ? '...' : stats.totalInstructors.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <TrendingUp size={14} />
                  <span>+{loading ? '...' : stats.instructorGrowth}% since last month</span>
                </div>
              </div>

              {/* Total Exams */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-400 mb-3">Total Exams Uploaded</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {loading ? '...' : stats.totalExamsUploaded.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <TrendingUp size={14} />
                  <span>+{loading ? '...' : stats.examGrowth}% since last month</span>
                </div>
              </div>
            </div>

            {/* User Growth Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">
                User Growth Statistics (Last 12 Months)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#9CA3AF" 
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    dot={false}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#2563EB" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* User Growth List */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">User Growth</h2>
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-semibold text-white">
                      {user.initial}
                    </div>
                    <span className="text-white text-sm">{user.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Courses Stats */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Dashboard</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm text-gray-400 mb-3 leading-tight">
                    Total<br />Rooms
                  </h3>
                  <div className="text-5xl font-bold text-white">
                    {loading ? '...' : stats.totalExams}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400 mb-3 leading-tight">
                    Published<br />Rooms
                  </h3>
                  <div className="text-5xl font-bold text-white">
                    {loading ? '...' : stats.publishedRooms}
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Exams */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Upcoming Exams</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-white font-medium">Python Basics</div>
                  <div className="text-gray-400 text-sm">MCQ</div>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">MCQ</span>
                  <span className="text-gray-400">Not Started</span>
                </div>
                
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                  Start Exam
                </button>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Performance</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="exam" 
                    stroke="#9CA3AF" 
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Additional Performance Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Performance</h2>
              <div className="h-32 flex items-center justify-center text-gray-400">
                Additional metrics coming soon...
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;