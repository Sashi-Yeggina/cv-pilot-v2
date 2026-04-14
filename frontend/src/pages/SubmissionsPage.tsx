import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { submissionsAPI } from '../services/api';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  user_id: string;
  generation_id?: string;
  cv_id?: string;
  jd_id?: string;
  candidate_name?: string;
  vendor_name?: string;
  client_name?: string;
  client_email?: string;
  role_title?: string;
  status: string;
  notes?: string;
  submitted_at?: string;
  follow_up_at?: string;
  interview_at?: string;
  created_at: string;
  updated_at?: string;
}

interface Pipeline {
  to_submit: number;
  submitted: number;
  reviewing: number;
  interview: number;
  offer: number;
  hired: number;
  rejected: number;
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { key: string; label: string; color: string; icon: string }[] = [
  { key: 'to_submit',  label: 'To Submit',  color: 'bg-gray-100 border-gray-300',     icon: '📝' },
  { key: 'submitted',  label: 'Submitted',  color: 'bg-blue-50 border-blue-300',      icon: '📤' },
  { key: 'reviewing',  label: 'Reviewing',  color: 'bg-yellow-50 border-yellow-300',  icon: '🔍' },
  { key: 'interview',  label: 'Interview',  color: 'bg-purple-50 border-purple-300',  icon: '🎙️' },
  { key: 'offer',      label: 'Offer',      color: 'bg-teal-50 border-teal-300',      icon: '🤝' },
  { key: 'hired',      label: 'Hired',      color: 'bg-green-50 border-green-300',    icon: '✅' },
  { key: 'rejected',   label: 'Rejected',   color: 'bg-red-50 border-red-300',        icon: '❌' },
];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  to_submit:  ['submitted', 'rejected'],
  submitted:  ['reviewing', 'rejected'],
  reviewing:  ['interview', 'rejected'],
  interview:  ['offer', 'rejected'],
  offer:      ['hired', 'rejected'],
  hired:      [],
  rejected:   ['to_submit'],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubmissionCard({
  submission,
  onMoveStatus,
  onEdit,
  onDelete,
}: {
  submission: Submission;
  onMoveStatus: (id: string, status: string) => void;
  onEdit: (s: Submission) => void;
  onDelete: (id: string) => void;
}) {
  const nextStatuses = STATUS_TRANSITIONS[submission.status] || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-2 group">
      {/* Role */}
      <div>
        <p className="font-semibold text-sm text-gray-800 truncate">
          {submission.role_title || 'Unknown Role'}
        </p>
        {submission.client_name && (
          <p className="text-xs text-gray-500 truncate">{submission.client_name}</p>
        )}
        {submission.vendor_name && (
          <p className="text-xs text-gray-400 truncate">via {submission.vendor_name}</p>
        )}
      </div>

      {/* Candidate */}
      {submission.candidate_name && (
        <p className="text-xs text-blue-600 font-medium">👤 {submission.candidate_name}</p>
      )}

      {/* Email */}
      {submission.client_email && (
        <p className="text-xs text-gray-400 truncate">✉️ {submission.client_email}</p>
      )}

      {/* Key dates */}
      {submission.submitted_at && (
        <p className="text-xs text-gray-400">
          Sent: {new Date(submission.submitted_at).toLocaleDateString()}
        </p>
      )}
      {submission.interview_at && (
        <p className="text-xs text-purple-600">
          Interview: {new Date(submission.interview_at).toLocaleDateString()}
        </p>
      )}

      {/* Notes */}
      {submission.notes && (
        <p className="text-xs text-gray-500 italic line-clamp-2">{submission.notes}</p>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1">
        {nextStatuses.map(s => {
          const col = COLUMNS.find(c => c.key === s);
          return (
            <button
              key={s}
              onClick={() => onMoveStatus(submission.id, s)}
              className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition"
            >
              → {col?.icon} {col?.label}
            </button>
          );
        })}
        <button
          onClick={() => onEdit(submission)}
          className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition ml-auto"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(submission.id)}
          className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function EditModal({
  submission,
  onClose,
  onSave,
}: {
  submission: Submission;
  onClose: () => void;
  onSave: (id: string, data: Partial<Submission>) => void;
}) {
  const [notes, setNotes] = useState(submission.notes || '');
  const [candidateName, setCandidateName] = useState(submission.candidate_name || '');
  const [followUpAt, setFollowUpAt] = useState(submission.follow_up_at ? submission.follow_up_at.slice(0, 10) : '');
  const [interviewAt, setInterviewAt] = useState(submission.interview_at ? submission.interview_at.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(submission.id, {
      notes,
      candidate_name: candidateName,
      follow_up_at: followUpAt || undefined,
      interview_at: interviewAt || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Edit Submission</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">Candidate Name</p>
          <input
            type="text"
            value={candidateName}
            onChange={e => setCandidateName(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Follow-up Date</p>
            <input
              type="date"
              value={followUpAt}
              onChange={e => setFollowUpAt(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Interview Date</p>
            <input
              type="date"
              value={interviewAt}
              onChange={e => setInterviewAt(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Submission | null>(null);
  const navigate = useNavigate();

  const loadSubmissions = useCallback(async () => {
    try {
      const resp = await submissionsAPI.list();
      setSubmissions(resp.data.submissions || []);
      setPipeline(resp.data.pipeline || null);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleMoveStatus = async (id: string, newStatus: string) => {
    try {
      const resp = await submissionsAPI.update(id, { status: newStatus });
      setSubmissions(prev =>
        prev.map(s => s.id === id ? { ...s, ...resp.data } : s)
      );
      toast.success(`Moved to ${newStatus.replace('_', ' ')}`);
      // Refresh pipeline counts
      loadSubmissions();
    } catch {
      toast.error('Failed to update submission');
    }
  };

  const handleEdit = (s: Submission) => setEditTarget(s);

  const handleEditSave = async (id: string, data: any) => {
    try {
      const resp = await submissionsAPI.update(id, data);
      setSubmissions(prev =>
        prev.map(s => s.id === id ? { ...s, ...resp.data } : s)
      );
      setEditTarget(null);
      toast.success('Submission updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this submission?')) return;
    try {
      await submissionsAPI.delete(id);
      setSubmissions(prev => prev.filter(s => s.id !== id));
      toast.success('Submission deleted');
      loadSubmissions();
    } catch {
      toast.error('Failed to delete');
    }
  };

  // Group by status
  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = submissions.filter(s => s.status === col.key);
    return acc;
  }, {} as Record<string, Submission[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline text-sm">
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold text-purple-700">📋 Submission Pipeline</h1>
          <div className="ml-auto flex items-center gap-3">
            {pipeline && (
              <div className="flex gap-4 text-sm text-gray-600">
                <span><strong>{pipeline.total}</strong> total</span>
                <span className="text-green-600"><strong>{pipeline.hired}</strong> hired</span>
                <span className="text-blue-600"><strong>{pipeline.interview}</strong> interviewing</span>
              </div>
            )}
            <button
              onClick={() => navigate('/generate')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
            >
              + New CV
            </button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="max-w-screen-xl mx-auto px-4 py-6">
          {submissions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-12 text-center">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-semibold text-gray-700 mb-2">No submissions yet</p>
              <p className="text-sm text-gray-500 mb-6">
                Submissions are auto-created when you generate a CV. You can also create them manually.
              </p>
              <button
                onClick={() => navigate('/generate')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
              >
                Generate Your First CV
              </button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map(col => (
                <div
                  key={col.key}
                  className={`flex-shrink-0 w-64 rounded-xl border-2 ${col.color} p-3`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-gray-700">
                      {col.icon} {col.label}
                    </span>
                    <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200">
                      {byStatus[col.key]?.length || 0}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {byStatus[col.key]?.length === 0 && (
                      <div className="text-center text-xs text-gray-400 py-4">Empty</div>
                    )}
                    {byStatus[col.key]?.map(s => (
                      <SubmissionCard
                        key={s.id}
                        submission={s}
                        onMoveStatus={handleMoveStatus}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          submission={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
