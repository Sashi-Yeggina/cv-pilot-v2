import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvAPI, bulkAPI } from '../services/api';
import type { BulkJDItem } from '../services/api';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulkJob {
  id: string;
  status: string;
  total_count: number;
  completed_count: number;
  failed_count: number;
  created_at: string;
  completed_at?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyItem = (): BulkJDItem => ({
  jd_text: '',
  role_title: '',
  vendor_name: '',
  client_name: '',
  client_email: '',
  notes: '',
});

// ─── JD Item Row ─────────────────────────────────────────────────────────────

function JDItemRow({
  index,
  item,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  item: BulkJDItem;
  onChange: (idx: number, field: keyof BulkJDItem, value: string) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {item.role_title || item.client_name || `Job Description ${index + 1}`}
          </p>
          {item.client_email && (
            <p className="text-xs text-gray-400 truncate">{item.client_email}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.jd_text.trim() && (
            <span className="text-xs text-green-600 font-medium">✓ JD added</span>
          )}
          {canRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(index); }}
              className="text-red-400 hover:text-red-600 text-lg leading-none"
            >
              ×
            </button>
          )}
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          <div>
            <label className="text-xs text-gray-500 block mb-1 mt-3">Job Description Text *</label>
            <textarea
              value={item.jd_text}
              onChange={e => onChange(index, 'jd_text', e.target.value)}
              placeholder="Paste the full job description…"
              rows={5}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Role Title</label>
              <input
                type="text"
                value={item.role_title || ''}
                onChange={e => onChange(index, 'role_title', e.target.value)}
                placeholder="e.g. Senior Developer"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vendor / Agency</label>
              <input
                type="text"
                value={item.vendor_name || ''}
                onChange={e => onChange(index, 'vendor_name', e.target.value)}
                placeholder="e.g. TechSearch Ltd"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Client Company</label>
              <input
                type="text"
                value={item.client_name || ''}
                onChange={e => onChange(index, 'client_name', e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Client Email</label>
              <input
                type="email"
                value={item.client_email || ''}
                onChange={e => onChange(index, 'client_email', e.target.value)}
                placeholder="recruiter@client.com"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <input
                type="text"
                value={item.notes || ''}
                onChange={e => onChange(index, 'notes', e.target.value)}
                placeholder="Any additional notes…"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress Tracker ─────────────────────────────────────────────────────────

function BulkJobProgress({ job }: { job: BulkJob }) {
  const done     = job.completed_count + job.failed_count;
  const pct      = job.total_count > 0 ? Math.round((done / job.total_count) * 100) : 0;
  const isActive = job.status === 'pending' || job.status === 'processing';

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-800">Bulk Generation Progress</h3>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          job.status === 'completed'        ? 'bg-green-100 text-green-700' :
          job.status === 'partial_failure'  ? 'bg-yellow-100 text-yellow-700' :
          job.status === 'failed'           ? 'bg-red-100 text-red-700' :
                                              'bg-blue-100 text-blue-700'
        }`}>
          {job.status.replace('_', ' ')}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{done} / {job.total_count} done</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-blue-700">{job.total_count}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-700">{job.completed_count}</p>
          <p className="text-xs text-gray-500">Succeeded</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-red-700">{job.failed_count}</p>
          <p className="text-xs text-gray-500">Failed</p>
        </div>
      </div>

      {job.completed_at && (
        <p className="text-xs text-gray-400">
          Completed: {new Date(job.completed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BulkGeneratePage() {
  const [cvs, setCvs] = useState<any[]>([]);
  const [templateCVs, setTemplateCVs] = useState<any[]>([]);
  const [selectedCVs, setSelectedCVs] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [items, setItems] = useState<BulkJDItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<BulkJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCVs();
    loadRecentJobs();
  }, []);

  // Auto-poll the active job
  useEffect(() => {
    if (!bulkJob) return;
    if (bulkJob.status === 'completed' || bulkJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const resp = await bulkAPI.getJob(bulkJob.id);
        setBulkJob(resp.data);
        if (resp.data.status === 'completed' || resp.data.status === 'partial_failure') {
          toast.success('Bulk generation complete!');
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [bulkJob?.id, bulkJob?.status]);

  const loadCVs = async () => {
    try {
      const [baseResp, tmplResp] = await Promise.all([
        cvAPI.list('base'),
        cvAPI.list('template').catch(() => ({ data: { cvs: [] } })),
      ]);
      setCvs(baseResp.data.cvs.filter((c: any) => c.cv_type === 'base'));
      setTemplateCVs(tmplResp.data.cvs || []);
    } catch {
      toast.error('Failed to load CVs');
    }
  };

  const loadRecentJobs = async () => {
    setLoadingJobs(true);
    try {
      const resp = await bulkAPI.listJobs();
      setRecentJobs(resp.data.jobs || []);
    } catch {
      // Non-fatal
    } finally {
      setLoadingJobs(false);
    }
  };

  const toggleCV = (cvId: string) => {
    setSelectedCVs(prev => {
      if (prev.includes(cvId)) return prev.filter(id => id !== cvId);
      if (prev.length >= 3) { toast.error('Select up to 3 CVs'); return prev; }
      return [...prev, cvId];
    });
  };

  const handleItemChange = (idx: number, field: keyof BulkJDItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    if (items.length >= 20) { toast.error('Maximum 20 JDs per bulk job'); return; }
    setItems(prev => [...prev, emptyItem()]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (selectedCVs.length === 0) {
      toast.error('Select at least 1 base CV');
      return;
    }
    const validItems = items.filter(i => i.jd_text.trim());
    if (validItems.length === 0) {
      toast.error('Add at least 1 job description');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await bulkAPI.generate(
        selectedCVs,
        validItems,
        selectedTemplate || undefined,
      );
      setBulkJob({
        id:               resp.data.bulk_job_id,
        status:           resp.data.status,
        total_count:      resp.data.total_count,
        completed_count:  0,
        failed_count:     0,
        created_at:       new Date().toISOString(),
      });
      toast.success(`Bulk job started — ${validItems.length} CVs queued`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start bulk job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline text-sm">
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold text-blue-700">⚡ Bulk CV Generation</h1>
          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            1 Candidate → Many JDs
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Active job progress */}
        {bulkJob && <BulkJobProgress job={bulkJob} />}

        {/* CV Selection */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-1">Step 1 — Select Candidate CVs</h2>
          <p className="text-sm text-gray-500 mb-4">Pick 1–3 base CVs for the candidate. These will be used for all JDs in this batch.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {cvs.length === 0 ? (
              <p className="text-gray-500 text-sm col-span-2">No base CVs found. Upload at least one first.</p>
            ) : cvs.map(cv => (
              <label key={cv.id} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={selectedCVs.includes(cv.id)}
                  onChange={() => toggleCV(cv.id)}
                  className="w-4 h-4 accent-blue-600"
                />
                <div className="ml-3 flex-1">
                  <p className="font-medium text-sm truncate">{cv.filename}</p>
                  <p className="text-xs text-gray-500">{cv.role_title || 'No title'}</p>
                </div>
                {selectedCVs.includes(cv.id) && <span className="text-blue-600 font-bold">✓</span>}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Selected: {selectedCVs.length} / 3</p>

          {templateCVs.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold mb-2">Template CV (optional)</p>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">No template</option>
                {templateCVs.map(t => (
                  <option key={t.id} value={t.id}>{t.filename}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* JD List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Step 2 — Add Job Descriptions</h2>
            <span className="text-sm text-gray-500">{items.length} / 20</span>
          </div>

          {items.map((item, idx) => (
            <JDItemRow
              key={idx}
              index={idx}
              item={item}
              onChange={handleItemChange}
              onRemove={removeItem}
              canRemove={items.length > 1}
            />
          ))}

          <button
            onClick={addItem}
            disabled={items.length >= 20}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition font-medium disabled:opacity-50"
          >
            + Add Another Job Description
          </button>
        </div>

        {/* Summary & Submit */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Ready to generate <strong>{items.filter(i => i.jd_text.trim()).length}</strong> CVs
                for <strong>{selectedCVs.length}</strong> base CV{selectedCVs.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Each JD is processed independently in parallel. Results appear in your Submission Pipeline.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate('/submissions')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
            >
              📋 View Pipeline
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedCVs.length === 0 || items.filter(i => i.jd_text.trim()).length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '⏳ Submitting…' : '⚡ Start Bulk Generation'}
            </button>
          </div>
        </div>

        {/* Recent jobs */}
        {recentJobs.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-bold text-gray-700 mb-4">Recent Bulk Jobs</h3>
            <div className="space-y-3">
              {recentJobs.slice(0, 5).map(job => (
                <div key={job.id} className="flex items-center gap-4 text-sm border-b border-gray-100 pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">
                      {job.completed_count}/{job.total_count} CVs
                      {job.failed_count > 0 && <span className="text-red-500 ml-1">({job.failed_count} failed)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(job.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    job.status === 'completed'       ? 'bg-green-100 text-green-700' :
                    job.status === 'partial_failure' ? 'bg-yellow-100 text-yellow-700' :
                    job.status === 'failed'          ? 'bg-red-100 text-red-700' :
                                                       'bg-blue-100 text-blue-700'
                  }`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
