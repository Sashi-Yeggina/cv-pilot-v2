import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, generationAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  description: string;
  tier: string;
  approx_cost: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
  is_active: boolean;
  allowed_model?: string;
  model_label?: string;
  model_updated_at?: string;
  model_updated_by?: string;
}

interface UsageRow {
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  allowed_model: string;
  model_label: string;
  total_generations: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  api_calls_saved: number;
  avg_coverage_pct: number;
  gens_library_only: number;
  gens_library_plus_api: number;
  gens_full_api: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tierStyle: Record<string, string> = {
  standard: 'bg-green-100 text-green-800',
  premium:  'bg-yellow-100 text-yellow-800',
  elite:    'bg-purple-100 text-purple-800',
};

function modelTier(model?: string) {
  if (!model) return 'standard';
  if (model.includes('haiku'))  return 'standard';
  if (model.includes('sonnet')) return 'premium';
  if (model.includes('opus'))   return 'elite';
  return 'standard';
}

function ModelBadge({ model, label }: { model?: string; label?: string }) {
  const tier = modelTier(model);
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierStyle[tier]}`}>
      {label || model || 'Haiku'}
    </span>
  );
}

function fmtCost(usd: number) {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Model Selector Modal ────────────────────────────────────────────────────

function ModelModal({
  user, models, onClose, onSave,
}: {
  user: UserRow;
  models: ModelOption[];
  onClose: () => void;
  onSave: (userId: string, model: string, reason: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(user.allowed_model || 'claude-haiku-4-5-20251001');
  const [reason, setReason]     = useState('');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(user.id, selected, reason);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold">Assign Claude Model</h3>
            <p className="text-sm text-gray-500">{user.full_name || user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {user.model_updated_by && (
          <div className="px-6 py-2 bg-gray-50 text-xs text-gray-500 flex items-center gap-2">
            Current: <ModelBadge model={user.allowed_model} label={user.model_label} />
            — set by {user.model_updated_by}
          </div>
        )}

        <div className="px-6 py-4 space-y-3">
          {models.map(m => (
            <label key={m.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
              selected === m.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="model" value={m.id} checked={selected === m.id}
                onChange={() => setSelected(m.id)} className="mt-0.5 accent-blue-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{m.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tierStyle[m.tier]}`}>{m.tier}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{m.approx_cost}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="px-6 pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason (saved to audit log)</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Senior consultant, needs higher quality output"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || selected === user.allowed_model}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold">
            {saving ? 'Saving…' : 'Save Model'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Generate Modal ────────────────────────────────────────────────────

function AdminGenerateModal({
  users, onClose,
}: {
  users: UserRow[];
  onClose: () => void;
}) {
  const [targetUserId, setTargetUserId] = useState('');
  const [userCVs,      setUserCVs]      = useState<any[]>([]);
  const [selectedCVs,  setSelectedCVs]  = useState<string[]>([]);
  const [templateId,   setTemplateId]   = useState('');
  const [jdText,       setJdText]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [genResult,    setGenResult]    = useState<any>(null);
  const [genStatus,    setGenStatus]    = useState<any>(null);

  const regularUsers = users.filter(u => u.role !== 'admin');

  // Load CVs when user is selected
  useEffect(() => {
    if (!targetUserId) { setUserCVs([]); setSelectedCVs([]); setTemplateId(''); return; }
    setLoading(true);
    adminAPI.getUserCVs(targetUserId)
      .then(r => setUserCVs(r.data.cvs || []))
      .catch(() => toast.error('Failed to load user CVs'))
      .finally(() => setLoading(false));
  }, [targetUserId]);

  const baseCVs     = userCVs.filter(c => c.cv_type === 'base');
  const templateCVs = userCVs.filter(c => c.cv_type === 'template');

  const toggleCV = (id: string) => {
    setSelectedCVs(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleGenerate = async () => {
    if (!targetUserId || !jdText.trim() || selectedCVs.length === 0) {
      toast.error('Select a user, at least one CV, and paste a JD');
      return;
    }
    setGenerating(true);
    try {
      const r = await adminAPI.generateForUser(targetUserId, jdText, selectedCVs, templateId || undefined);
      setGenResult(r.data);
      toast.success('Generation started!');

      // Poll status
      let done = false; let tries = 0;
      while (!done && tries < 60) {
        await new Promise(res => setTimeout(res, 2000));
        const s = await generationAPI.getStatus(r.data.generation_id);
        setGenStatus(s.data);
        if (s.data.status === 'success' || s.data.status === 'failed') {
          done = true;
          if (s.data.status === 'success') toast.success('CV generated!');
          else toast.error(`Failed: ${s.data.error_message}`);
        }
        tries++;
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const targetUser = users.find(u => u.id === targetUserId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">⚡ Generate CV as Admin</h3>
            <p className="text-sm text-gray-500">Generate a CV on behalf of any user</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Step 1: Pick user */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">1. Select User</label>
            <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Choose a user —</option>
              {regularUsers.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
              ))}
            </select>
            {targetUser && (
              <p className="text-xs text-gray-400 mt-1">
                Model: <ModelBadge model={targetUser.allowed_model} label={targetUser.model_label} />
              </p>
            )}
          </div>

          {/* Step 2: Pick CVs */}
          {targetUserId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                2. Select Base CV(s) {loading && <span className="text-gray-400 font-normal">Loading…</span>}
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                {baseCVs.length === 0 && !loading && (
                  <p className="text-xs text-gray-400 py-2 text-center">No base CVs for this user.</p>
                )}
                {baseCVs.map(cv => (
                  <label key={cv.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                    selectedCVs.includes(cv.id) ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50 border border-transparent'
                  }`}>
                    <input type="checkbox" checked={selectedCVs.includes(cv.id)} onChange={() => toggleCV(cv.id)}
                      className="accent-blue-600" />
                    <span className="text-sm">{cv.filename}</span>
                    <span className="text-xs text-gray-400">{cv.role_title || ''}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{selectedCVs.length} selected (max 3)</p>

              {templateCVs.length > 0 && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Template (optional)</label>
                  <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">No template</option>
                    {templateCVs.map(t => <option key={t.id} value={t.id}>{t.filename}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 3: JD */}
          {targetUserId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">3. Paste Job Description</label>
              <textarea value={jdText} onChange={e => setJdText(e.target.value)}
                placeholder="Paste the full job description here…"
                className="w-full h-40 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          )}

          {/* Generation result */}
          {genStatus && (
            <div className={`rounded-lg p-4 text-sm ${
              genStatus.status === 'success' ? 'bg-green-50 border border-green-200' :
              genStatus.status === 'failed'  ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                {genStatus.status === 'processing' && <><span className="animate-spin border-2 border-blue-600 border-t-transparent rounded-full w-4 h-4 flex-shrink-0" />Processing…</>}
                {genStatus.status === 'success'    && <>✅ CV Generated!</>}
                {genStatus.status === 'failed'     && <>❌ Failed</>}
              </div>
              {genStatus.processing_time_ms && (
                <p className="text-gray-500">Time: {(genStatus.processing_time_ms / 1000).toFixed(1)}s</p>
              )}
              {genStatus.error_message && <p className="text-red-600">{genStatus.error_message}</p>}
              {genStatus.generated_cv_id && genStatus.status === 'success' && (
                <a href={`/api/cv/${genStatus.generated_cv_id}/download`} download
                  className="inline-block mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
                  ⬇️ Download CV
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
          <button onClick={handleGenerate}
            disabled={generating || !targetUserId || selectedCVs.length === 0 || !jdText.trim()}
            className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold">
            {generating ? 'Generating…' : '⚡ Generate CV'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [usageData,    setUsageData]    = useState<{ users: UsageRow[]; platform: any } | null>(null);
  const [activities,   setActivities]   = useState<any[]>([]);
  const [stats,        setStats]        = useState<any>({});
  const [models,       setModels]       = useState<ModelOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editingUser,  setEditingUser]  = useState<UserRow | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [activeTab,    setActiveTab]    = useState<'users' | 'usage' | 'activity' | 'stats'>('users');

  const navigate  = useNavigate();
  const { logout } = useAuthStore();

  const loadAdminData = useCallback(async () => {
    try {
      const [usersRes, activitiesRes, statsRes, modelsRes, usageRes] = await Promise.all([
        adminAPI.getUsers(),
        adminAPI.getActivityStream(),
        adminAPI.getStats(),
        adminAPI.listModels(),
        adminAPI.getUsage(),
      ]);
      setUsers(usersRes.data.users);
      setActivities(activitiesRes.data.logs);
      setStats(statsRes.data);
      setModels(modelsRes.data.models || []);
      setUsageData(usageRes.data);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
    const iv = setInterval(loadAdminData, 15000);
    return () => clearInterval(iv);
  }, [loadAdminData]);

  const handleSaveModel = async (userId: string, model: string, reason: string) => {
    try {
      await adminAPI.updateUserModel(userId, model, reason);
      toast.success('Model updated');
      setEditingUser(null);
      const r = await adminAPI.getUsers();
      setUsers(r.data.users);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to update model');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const modelCounts = users.reduce<Record<string, number>>((acc, u) => {
    const k = u.model_label || 'Haiku (Fast · Low Cost)';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'users',    label: 'Users' },
    { id: 'usage',    label: 'Usage & Cost' },
    { id: 'activity', label: 'Activity' },
    { id: 'stats',    label: 'Stats' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-blue-700 mr-2">Admin Dashboard</h1>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={() => setShowGenerate(true)}
              className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
              ⚡ Generate CV
            </button>
            <button onClick={() => { logout(); navigate('/login'); }}
              className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Users',          value: stats.total_users,                    color: 'text-blue-600' },
            { label: 'CVs',            value: stats.total_cvs,                      color: 'text-green-600' },
            { label: 'Generations',    value: stats.total_generations,              color: 'text-purple-600' },
            { label: 'Library Bullets',value: stats.total_library_bullets ?? '—',   color: 'text-orange-600' },
            { label: 'Total Cost',     value: fmtCost(usageData?.platform?.total_cost_usd ?? 0), color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value ?? 0}</p>
            </div>
          ))}
        </div>

        {/* Model distribution strip */}
        {Object.keys(modelCounts).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-3 mb-6 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-semibold text-gray-500">Models in use:</span>
            {Object.entries(modelCounts).map(([label, count]) => (
              <div key={label} className="flex items-center gap-1.5">
                <ModelBadge label={label} />
                <span className="text-xs text-gray-600 font-medium">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="font-bold text-lg">Users ({users.length})</h2>
              <p className="text-xs text-gray-400">Click "Change Model" to assign a Claude model per user</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['User','Role','Claude Model','Set By','Joined',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ModelBadge model={u.allowed_model} label={u.model_label} />
                        <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[150px]">
                          {u.allowed_model || 'claude-haiku-4-5-20251001'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {u.model_updated_by || <span className="text-gray-300">default</span>}
                        {u.model_updated_at && <><br />{new Date(u.model_updated_at).toLocaleDateString()}</>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {u.role !== 'admin' && (
                          <button onClick={() => setEditingUser(u)}
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200">
                            Change Model
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USAGE & COST TAB ── */}
        {activeTab === 'usage' && usageData && (
          <div className="space-y-6">
            {/* Platform totals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Spend',      value: fmtCost(usageData.platform.total_cost_usd),    sub: 'all time', color: 'text-red-600' },
                { label: 'Total Tokens',     value: fmtTokens(usageData.platform.total_tokens),    sub: 'input + output', color: 'text-blue-600' },
                { label: 'Generations',      value: usageData.platform.total_generations,           sub: 'all users', color: 'text-purple-600' },
                { label: 'API Calls Saved',  value: usageData.platform.total_calls_saved,           sub: 'by library reuse', color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl shadow-sm p-5">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Per-user table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="font-bold text-lg">Per-User Cost Breakdown</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sorted by total spend (highest first)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['User','Model','Gens','Tokens In','Tokens Out','Cost','Calls Saved','Avg Coverage','Strategy Mix'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.users.map(u => {
                      const libPct = u.total_generations > 0
                        ? Math.round(((u.gens_library_only + u.gens_library_plus_api) / u.total_generations) * 100)
                        : 0;
                      return (
                        <tr key={u.user_id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <p className="font-medium truncate max-w-[140px]">{u.full_name || u.email}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[140px]">{u.email}</p>
                          </td>
                          <td className="px-3 py-3"><ModelBadge model={u.allowed_model} label={u.model_label} /></td>
                          <td className="px-3 py-3 font-medium">{u.total_generations}</td>
                          <td className="px-3 py-3 font-mono text-xs">{fmtTokens(u.total_input_tokens)}</td>
                          <td className="px-3 py-3 font-mono text-xs">{fmtTokens(u.total_output_tokens)}</td>
                          <td className="px-3 py-3 font-bold text-red-600">{fmtCost(u.total_cost_usd)}</td>
                          <td className="px-3 py-3 text-green-600 font-medium">{u.api_calls_saved}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${u.avg_coverage_pct >= 80 ? 'bg-green-500' : u.avg_coverage_pct >= 55 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                  style={{ width: `${u.avg_coverage_pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-600">{u.avg_coverage_pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1 text-xs">
                              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded" title="Library only">{u.gens_library_only}L</span>
                              <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded" title="Library + API patch">{u.gens_library_plus_api}P</span>
                              <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded" title="Full API">{u.gens_full_api}F</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{libPct}% library</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-400">
                L = Library Only &nbsp;·&nbsp; P = Library + API Patch &nbsp;·&nbsp; F = Full API Generation
              </div>
            </div>

            {/* Model cost comparison */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-base mb-4">Model Cost Reference</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { model: 'Haiku 4.5',  input: 0.80,  output: 4.00,  tier: 'standard', note: 'Default · fastest' },
                  { model: 'Sonnet 4.6', input: 3.00,  output: 15.00, tier: 'premium',  note: 'Balanced quality' },
                  { model: 'Opus 4.6',   input: 15.00, output: 75.00, tier: 'elite',    note: 'Highest quality' },
                ].map(m => (
                  <div key={m.model} className={`rounded-xl border-2 p-4 ${
                    m.tier === 'standard' ? 'border-green-200 bg-green-50' :
                    m.tier === 'premium'  ? 'border-yellow-200 bg-yellow-50' :
                    'border-purple-200 bg-purple-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierStyle[m.tier]}`}>{m.tier}</span>
                      <span className="font-bold text-sm">{m.model}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{m.note}</p>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between"><span className="text-gray-500">Input:</span><span>${m.input}/1M tokens</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Output:</span><span>${m.output}/1M tokens</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-lg">Activity Stream (last 50)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Action','Description','Time','Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activities.slice(0, 50).map(a => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{a.action_type}</td>
                      <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{a.description}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {a.success ? 'OK' : 'Fail'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-lg mb-4">Platform Overview</h3>
              {[
                ['Total Users',       stats.total_users],
                ['Total CVs',         stats.total_cvs],
                ['Total Generations', stats.total_generations],
                ['Library Bullets',   stats.total_library_bullets ?? '—'],
                ['API Calls Saved',   stats.total_api_calls_saved ?? '—'],
                ['Total Cost (est.)', fmtCost(usageData?.platform?.total_cost_usd ?? 0)],
                ['Total Tokens',      fmtTokens(usageData?.platform?.total_tokens ?? 0)],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-semibold">{v ?? 0}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-lg mb-4">Model Adoption</h3>
              {models.map(m => {
                const count = users.filter(u => (u.allowed_model || 'claude-haiku-4-5-20251001') === m.id).length;
                const pct   = users.length > 0 ? Math.round((count / users.length) * 100) : 0;
                return (
                  <div key={m.id} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-gray-500">{count} users ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${
                        m.tier === 'standard' ? 'bg-green-500' : m.tier === 'premium' ? 'bg-yellow-500' : 'bg-purple-500'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{m.approx_cost}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingUser && (
        <ModelModal user={editingUser} models={models} onClose={() => setEditingUser(null)} onSave={handleSaveModel} />
      )}
      {showGenerate && (
        <AdminGenerateModal users={users} onClose={() => setShowGenerate(false)} />
      )}
    </div>
  );
}
