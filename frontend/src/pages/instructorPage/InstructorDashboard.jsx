import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FiLogOut } from "react-icons/fi";
import InstructorSummary from "../../components/Instructor/InstructorSummary";

const InstructorDashboard = () => {
  const examsData = [
    { name: "T1", count: 120 },
    { name: "T2", count: 140 },
    { name: "T3", count: 180 },
    { name: "T4", count: 200 },
    { name: "T5", count: 200 },
    { name: "T6", count: 200 },
    { name: "T7", count: 200 },
    { name: "T8", count: 200 },
  ];

  const studentsData = [
    { name: "T1", count: 80 },
    { name: "T2", count: 100 },
    { name: "T3", count: 150 },
    { name: "T4", count: 170 },
    { name: "T5", count: 170 },
    { name: "T6", count: 170 },
    { name: "T7", count: 170 },
    { name: "T8", count: 170 },
  ];

  const totalExams = useMemo(
    () => examsData.reduce((sum, item) => sum + item.count, 0),
    [examsData]
  );

  const totalStudents = useMemo(
    () => studentsData.reduce((sum, item) => sum + item.count, 0),
    [studentsData]
  );

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <main className="flex-1 p-6">
        <div className="flex justify-end items-center mb-6">
          <div className="flex flex-row items-center gap-2">
            <p className="text-gray-500">
              Xin chào,{" "}
              <span className="font-semibold text-gray-700">(Name User)</span>
            </p>
            <button className="flex items-center gap-2 font-medium px-3 py-1.5 ">
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <InstructorSummary />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between flex-1 pb-12">
              <div>
                <h2 className="text-gray-700 font-semibold mb-1">Exams</h2>
                <h3 className="text-xl font-bold">{totalExams}</h3>
              </div>
              <img
                src="/icons/UI Image/rise.png"
                alt="Exams Icon"
                className="w-10 h-10 object-contain opacity-80"
              />
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={examsData}>
                <XAxis dataKey="name" />
                <Tooltip cursor={false} />
                <Bar dataKey="count" fill="#7AB8FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between flex-1 pb-12">
              <div>
                <h2 className="text-gray-700 font-semibold mb-1">Students</h2>
                <h3 className="text-xl font-bold">{totalStudents}</h3>
              </div>
              <img
                src="/icons/UI Image/down.png"
                alt="Students Icon"
                className="w-10 h-10 object-contain opacity-80"
              />
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={studentsData}>
                <XAxis dataKey="name" />
                <Tooltip cursor={false} />
                <Bar dataKey="count" fill="#F88FA1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorDashboard;
