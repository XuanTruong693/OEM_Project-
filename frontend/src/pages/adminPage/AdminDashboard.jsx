import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Clock, BookOpen } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useLanguage } from '../../context/LanguageContext';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
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
  const [upcomingExams, setUpcomingExams] = useState([]);

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

        // Fetch upcoming exams
        try {
          const upcomingRes = await axiosClient.get('/admin/upcoming-exams');
          if (upcomingRes.data.success) {
            setUpcomingExams(upcomingRes.data.exams.slice(0, 3));
          }
        } catch (e) {
          console.log('Could not fetch upcoming exams');
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

    const fetchTrafficAnomalies = async () => {
      try {
        const response = await axiosClient.get('/admin/traffic-anomalies');
        if (response.data.success) {
          setTrafficAnomalies(response.data.traffic);
        }
      } catch (error) {
        console.error('Error fetching traffic anomalies:', error);
      }
    };
    fetchTrafficAnomalies();
    const trafficInterval = setInterval(fetchTrafficAnomalies, 30000); // Update every 30s

    return () => clearInterval(trafficInterval);
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

  const [recentUsers, setRecentUsers] = useState([]);
  const [trafficAnomalies, setTrafficAnomalies] = useState([
    { name: '192.168.1.15', requests: 1850, type: 'Chrome / Win10' },
    { name: 'Nguyen Van A', requests: 1200, type: 'Safari / iPhone' },
    { name: '103.25.14.88', requests: 950, type: 'Firefox / Linux' },
    { name: 'Tran Thi B', requests: 600, type: 'Chrome / Android' },
    { name: '45.112.5.30', requests: 450, type: 'Edge / Win11' }
  ]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return language === 'vi' ? 'Chưa đặt' : 'Not set';
    return new Date(dateStr).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getExamStateClass = (state) => {
    switch (state) {
      case 'active': return 'bg-green-600/20 text-green-400';
      case 'upcoming': return 'bg-blue-600/20 text-blue-400';
      default: return 'bg-gray-600/20 text-gray-300';
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900">
      {/* Sidebar */}
      <AdminSidebar activeTab="dashboard" />

      {/* Main Content */}
      <main className="flex-1 p-4 pt-20 md:p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white">{t('dashboard')}</h1>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Spans 2 columns */}
          <div className="xl:col-span-2 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Students */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-300 mb-3">{t('totalStudents')}</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {loading ? '...' : stats.totalStudents.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <TrendingUp size={14} />
                  <span>+{loading ? '...' : stats.studentGrowth}% {t('sinceLastMonth')}</span>
                </div>
              </div>

              {/* Total Instructors */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-300 mb-3">{t('totalInstructors')}</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {loading ? '...' : stats.totalInstructors.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <TrendingUp size={14} />
                  <span>+{loading ? '...' : stats.instructorGrowth}% {t('sinceLastMonth')}</span>
                </div>
              </div>

              {/* Total Exams */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-sm text-gray-300 mb-3">{t('totalExams')}</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {loading ? '...' : stats.totalExamsUploaded.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-green-400 text-xs">
                  <TrendingUp size={14} />
                  <span>+{loading ? '...' : stats.examGrowth}% {t('sinceLastMonth')}</span>
                </div>
              </div>
            </div>

            {/* User Growth Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-6">
                {t('userGrowth')} ({t('last12Months')})
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    stroke="#6B7280"
                    axisLine={false}
                    tickLine={false}
                    style={{ fontSize: '11px', fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    stroke="#6B7280"
                    axisLine={false}
                    tickLine={false}
                    style={{ fontSize: '11px' }}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                      color: '#fff',
                      padding: '12px 16px'
                    }}
                    labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    fill="url(#colorUsers)"
                    dot={false}
                    activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fill="url(#colorValue)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
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
              <h2 className="text-lg font-semibold text-white mb-6">{t('dashboard')}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm text-gray-300 mb-3 leading-tight">
                    {t('totalRooms')}
                  </h3>
                  <div className="text-5xl font-bold text-white">
                    {loading ? '...' : stats.totalExams}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm text-gray-300 mb-3 leading-tight">
                    {t('publishedRooms')}
                  </h3>
                  <div className="text-5xl font-bold text-white">
                    {loading ? '...' : stats.publishedRooms}
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Exams */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">{t('upcomingExams')}</h2>

              <div className="space-y-4">
                {upcomingExams.length === 0 ? (
                  <p className="text-gray-300 text-center py-4">{t('noData')}</p>
                ) : (
                  upcomingExams.map((exam) => (
                    <div key={exam.id} className="p-3 bg-gray-700/30 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-white font-medium truncate flex-1">{exam.title}</div>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getExamStateClass(exam.exam_state)}`}>
                          {exam.exam_state === 'active' ? t('ongoing') : t('upcoming')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-300">
                        <Clock size={12} />
                        <span>{formatDateTime(exam.time_open)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2 text-xs">
                        <span className="text-gray-300">{exam.total_questions} {t('questions')}</span>
                        <span className="text-gray-300">{exam.instructor_name}</span>
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={() => navigate('/admin/exams')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {t('viewAllExams')}
                </button>
              </div>
            </div>

            {/* Performance Chart (Original Style) */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Performance</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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

            {/* Traffic Anomaly Monitoring (Area Chart Style) */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-white">Traffic Anomaly Monitoring</h2>
                <span className="px-2 py-1 bg-red-600/20 text-red-400 text-[10px] font-bold uppercase rounded border border-red-600/30">
                  Live Alert
                </span>
              </div>
              
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trafficAnomalies}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={true} horizontal={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#9CA3AF"
                    style={{ fontSize: '10px' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    style={{ fontSize: '10px' }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 2000]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #EF4444',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#EF4444"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRequests)"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-4 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
                <p className="text-[11px] text-red-300/80 leading-relaxed italic">
                  {trafficAnomalies[0]?.requests > 100 ? (
                    <>
                      * Warning: Detected unusual activity from <strong>{trafficAnomalies[0].name}</strong> with {trafficAnomalies[0].requests.toLocaleString()} requests. 
                      Potential security risk detected.
                    </>
                  ) : (
                    <>* Status: System traffic is within normal parameters. No significant anomalies detected.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

