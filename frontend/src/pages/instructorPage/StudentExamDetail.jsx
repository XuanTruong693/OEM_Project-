import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export default function StudentExamDetail() {
  const { examId, studentId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [mergingVideo, setMergingVideo] = useState(false);
  const [scores, setScores] = useState({
    mcq: 0,
    ai: 0,
    total: 0,
    perQuestion: [],
  });

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await axiosClient.get(
          `/instructor/exams/${examId}/students/${studentId}/detail`
        );
        setDetail(res.data);
        setScores({
          mcq: res.data.submission.mcq_score || 0,
          ai: res.data.submission.ai_score || 0,
          total: res.data.submission.total_score || 0,
          perQuestion: res.data.answers.map((a) => ({
            question_id: a.question_id,
            score: a.score || 0,
          })),
        });
        setLoading(false);
      } catch {
        navigate(-1);
      }
    };
    fetchDetail();
  }, [examId, studentId]);

  const handleApproveAll = async () => {
    try {
      await axiosClient.put(
        `/instructor/exams/${examId}/students/${studentId}/approve`,
        {
          mcq_score: scores.mcq,
          ai_score: scores.ai,
          total_score: scores.total,
        }
      );
      alert("Approved all scores!");
    } catch { }
  };

  const handleApprovePerQuestion = async (qid, newScore) => {
    const updated = scores.perQuestion.map((p) =>
      p.question_id === qid ? { ...p, score: newScore } : p
    );
    setScores({ ...scores, perQuestion: updated });
    try {
      await axiosClient.put(
        `/instructor/exams/${examId}/students/${studentId}/approve`,
        {
          per_question_scores: [{ question_id: qid, score: newScore }],
        }
      );
      alert("Approved question score!");
    } catch { }
  };

  const handleViewVideo = async (violationId = null) => {
    try {
      setMergingVideo(true);
      setVideoUrl(null);
      // Gọi API merge video
      const res = await axiosClient.post(`/submissions/${detail.submission.id}/videos/merge`, {
        violation_id: violationId
      });
      if (res.data?.video_url) {
        // Assume backend is on port 5000, adjust if it uses REACT_APP_API_URL
        const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
        const serverOrigin = baseURL.replace('/api', '');
        setVideoUrl(`${serverOrigin}${res.data.video_url}`);
      }
    } catch (err) {
      alert("Lỗi khi tải/ghép video: " + (err.response?.data?.error || err.message));
    } finally {
      setMergingVideo(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        Chi tiết Sinh viên: {detail.submission.student_name}
      </h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          MCQ Score:{" "}
          {editing ? (
            <input
              type="number"
              value={scores.mcq}
              onChange={(e) => setScores({ ...scores, mcq: e.target.value })}
            />
          ) : (
            scores.mcq
          )}
        </div>
        <div>
          AI Score:{" "}
          {editing ? (
            <input
              type="number"
              value={scores.ai}
              onChange={(e) => setScores({ ...scores, ai: e.target.value })}
            />
          ) : (
            scores.ai
          )}
        </div>
        <div>
          Total Score:{" "}
          {editing ? (
            <input
              type="number"
              value={scores.total}
              onChange={(e) => setScores({ ...scores, total: e.target.value })}
            />
          ) : (
            scores.total
          )}
        </div>
        <div>Status: {detail.submission.status}</div>
        <div>Cheating Count: {detail.submission.cheating_count}</div>
      </div>
      <button
        onClick={() => setEditing(!editing)}
        className="px-4 py-2 bg-blue-600 text-white"
      >
        Edit Mode
      </button>
      <button
        onClick={handleApproveAll}
        className="px-4 py-2 bg-green-600 text-white ml-2"
      >
        Approve All
      </button>

      <h2 className="text-xl mt-4">Câu trả lời</h2>
      {detail.answers.map((a) => (
        <div key={a.question_id} className="border p-4 mb-2">
          <p>
            {a.question_text} ({a.type}, {a.points} điểm)
          </p>
          <p>Answer: {a.answer_text || "Selected option"}</p>
          <p>
            Score:{" "}
            {editing ? (
              <input
                type="number"
                value={
                  scores.perQuestion.find(
                    (p) => p.question_id === a.question_id
                  )?.score
                }
                onChange={(e) =>
                  handleApprovePerQuestion(a.question_id, e.target.value)
                }
              />
            ) : (
              a.score
            )}
          </p>
          {editing && (
            <button
              onClick={() =>
                handleApprovePerQuestion(
                  a.question_id,
                  scores.perQuestion.find(
                    (p) => p.question_id === a.question_id
                  )?.score
                )
              }
            >
              Approve This
            </button>
          )}
        </div>
      ))}

      <div className="flex justify-between items-center mt-4">
        <h2 className="text-xl">Violations (Gian lận)</h2>
        <button
          onClick={() => handleViewVideo()}
          disabled={mergingVideo}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {mergingVideo ? "Đang ghép video..." : "Xem toàn bộ quá trình thi"}
        </button>
      </div>

      {videoUrl && (
        <div className="mt-4 p-4 border rounded bg-slate-50">
          <h3 className="font-bold mb-2">Video Bằng Chứng:</h3>
          <video controls className="w-full max-h-[500px] bg-black">
            <source src={videoUrl} type="video/mp4" />
            Trình duyệt của bạn không hỗ trợ HTML5 video.
          </video>
        </div>
      )}

      <table className="min-w-full bg-white border mt-4">
        <thead>
          <tr className="bg-slate-100 border-b">
            <th className="p-2 text-left">Event</th>
            <th className="p-2 text-left">Time</th>
            <th className="p-2 text-left">Details</th>
            <th className="p-2 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {detail.violations.map((v) => (
            <tr key={v.id} className="border-b hover:bg-slate-50">
              <td className="p-2">{v.event_type}</td>
              <td className="p-2">{new Date(v.timestamp).toLocaleString()}</td>
              <td className="p-2">
                {v.details?.message}{" "}
                {v.details?.key ? `(Phím: ${v.details.key})` : ""}
              </td>
              <td className="p-2 text-center">
                {/* Normally we'd pass v.proctor_id or something specific, but for now we pass general snapshot logic ID if implemented */}
                <button
                  onClick={() => handleViewVideo(v.id)}
                  disabled={mergingVideo}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                >
                  Xem lỗi này
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xl mt-4">AI Logs</h2>
    </div>
  );
}
