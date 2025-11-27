import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export default function StudentExamDetail() {
  const { examId, studentId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
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
    } catch {}
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
    } catch {}
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

      <h2 className="text-xl mt-4">Violations (Gian lận)</h2>
      <table className="min-w-full">
        <thead>
          <tr>
            <th>Event</th>
            <th>Time</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {detail.violations.map((v) => (
            <tr key={v.id}>
              <td>{v.event_type}</td>
              <td>{new Date(v.timestamp).toLocaleString()}</td>
              <td>
                {v.details?.message}{" "}
                {v.details?.key ? `(Phím: ${v.details.key})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xl mt-4">AI Logs</h2>
    </div>
  );
}
