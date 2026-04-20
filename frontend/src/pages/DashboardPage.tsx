import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvAPI, generationAPI, adminAPI, userAPI, useAuthStore } from '../services/api';
import toast from 'react-hot-toast';

// All available models — greyed out in dropdown if admin disabled them
const ALL_MODELS = [
  // ── Claude (Anthropic) ──
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku',
    provider: 'Claude',
    hint: 'Best for: quick drafts, junior roles, high volume. Fastest & most affordable.',
    cost: '~$0.001 / CV',
    badge: 'Standard',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet',
    provider: 'Claude',
    hint: 'Best for: most roles — great balance of quality and speed. Recommended default.',
    cost: '~$0.003 / CV',
    badge: 'Premium',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus',
    provider: 'Claude',
    hint: 'Best for: senior, executive, or highly competitive roles. Highest quality output.',
    cost: '~$0.015 / CV',
    badge: 'Elite',
  },
  // ── OpenAI (ChatGPT) ──
  {
    id: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    provider: 'OpenAI',
    hint: 'Best for: bulk generation, entry-level CVs. Ultra cheap — lowest cost per CV.',
    cost: '~$0.002 / CV',
    badge: 'Budget',
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    hint: 'Best for: MVP & production apps. Best value — great quality at ~1 cent per CV. ✅ Recommended.',
    cost: '~$0.007 / CV',
    badge: 'Standard',
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    provider: 'OpenAI',
    hint: 'Best for: high-quality CV rewrites, premium users. Strong formatting & rewriting.',
    cost: '~$0.05 / CV',
    badge: 'Premium',
  },
  {
    id: 'gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    provider: 'OpenAI',
    hint: 'Best for: better formatting & reasoning than 4.1 mini. Great upgrade for quality.',
    cost: '~$0.02 / CV',
    badge: 'Premium',
  },
];

export default function DashboardPage() {
  const [cvs, setCvs] = useState<any[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadType, setUploadType] = useState('base');
  const [enabledModelIds, setEnabledModelIds] = useState<Set<string>>(new Set(ALL_MODELS.map(m => m.id)));
  const [selectedModel, setSelectedModel] = useState<string>('claude-haiku-4-5');
  const [savingModel, setSavingModel] = useState(false);

  const navigate = useNavigate();
  const { email, role, userId, logout } = useAuthStore();

  useEffect(() => {
    loadCVs();
    loadGenerations();
    loadModels();
  }, []);

  const loadModels = async () => {
    // Fetch per-user restrictions from backend (/api/me) so they work
    // across different browsers/sessions (localStorage-only approach was broken).
    let perUserAllowed: string[] | null = null;
    try {
      const res = await userAPI.getMe();
      const data = res.data;
      // allowed_models: null means "all allowed"; an array means only those IDs
      if (Array.isArray(data.allowed_models) && data.allowed_models.length > 0) {
        perUserAllowed = data.allowed_models;
      }
      // Also update preferred model if admin set a default for this user
      if (data.allowed_model && !localStorage.getItem('preferred_model')) {
        localStorage.setItem('preferred_model', data.allowed_model);
      }
    } catch {
      // /api/me failed — fall back to showing all models (graceful degradation)
    }

    // Build the enabled set from the server-side allowed list
    const enabled = new Set(
      ALL_MODELS
        .map(m => m.id)
        .filter(id => perUserAllowed === null || perUserAllowed.includes(id))
    );

    setEnabledModelIds(enabled);
    // Restore saved preference, fall back to first enabled model
    const saved = localStorage.getItem('preferred_model');
    if (saved && enabled.has(saved)) {
      setSelectedModel(saved);
    } else {
      setSelectedModel([...enabled][0] || ALL_MODELS[0].id);
    }
  };

  const handleSaveModel = async () => {
    setSavingModel(true);
    try {
      localStorage.setItem('preferred_model', selectedModel);
      toast.success(`Model saved: ${ALL_MODELS.find(m => m.id === selectedModel)?.label}`);
    } finally {
      setSavingModel(false);
    }
  };

  const loadCVs = async () => {
    try {
      const response = await cvAPI.list();
      setCvs(response.data.cvs || []);
    } catch (error) {
      // Silently show empty state — no CVs yet is normal for new accounts
      setCvs([]);
    }
  };

  const loadGenerations = async () => {
    try {
      const response = await generationAPI.list();
      setGenerations(response.data.generations || []);
    } catch (error) {
      // Silently show empty state — no generations yet is normal for new accounts
      setGenerations([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Read uploadType directly from the select at upload time to avoid stale closure
    const currentType = (document.getElementById('cv-type-select') as HTMLSelectElement)?.value || uploadType;

    setUploadingFile(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      try {
        await cvAPI.upload(file, currentType);
        successCount++;
      } catch (error: any) {
        failCount++;
        toast.error(`${file.name}: ${error.response?.data?.detail || 'Upload failed'}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? `${files[0].name} uploaded as ${currentType === 'template' ? 'Template' : 'Base CV'}`
          : `${successCount} files uploaded successfully`
      );
      loadCVs();
    }

    // Reset the input so the same file can be re-selected if needed
    e.target.value = '';
    setUploadingFile(false);
  };

  const handleDeleteCV = async (cvId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      await cvAPI.delete(cvId);
      toast.success(`${filename} deleted`);
      loadCVs();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const baseCVs = cvs.filter(cv => cv.cv_type === 'base');
  const generatedCVs = cvs.filter(cv => cv.cv_type === 'generated');
  const templates = cvs.filter(cv => cv.cv_type === 'template');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-blue-600">CV Pilot</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">{email}</span>
            {role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
              >
                Admin Panel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Upload Your CVs</h2>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <label className="flex-1">
                <span className="block text-sm font-medium mb-2">CV Type</span>
                <select
                  id="cv-type-select"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="base">Base CV (2-3 needed)</option>
                  <option value="template">Template (formatting)</option>
                </select>
              </label>

              <label className="flex-1 flex flex-col justify-end">
                <input
                  type="file"
                  accept=".docx"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="hidden"
                  id="file-input"
                />
                <button
                  onClick={() => document.getElementById('file-input')?.click()}
                  disabled={uploadingFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingFile ? 'Uploading...' : uploadType === 'template' ? 'Upload Template' : 'Upload DOCX Files'}
                </button>
                {uploadType === 'base' && (
                  <p className="text-xs text-gray-400 mt-1">You can select multiple files at once</p>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* CV Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Base CVs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Base CVs ({baseCVs.length})</h3>
            <div className="space-y-2">
              {baseCVs.length === 0 ? (
                <p className="text-gray-500">No base CVs yet</p>
              ) : (
                baseCVs.map(cv => (
                  <div key={cv.id} className="p-3 bg-blue-50 rounded border border-blue-200 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{cv.filename}</p>
                      <p className="text-xs text-gray-600">{cv.role_title || 'No title'}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCV(cv.id, cv.filename)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0 mt-0.5"
                      title="Delete"
                    >×</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Templates */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Template</h3>
            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-gray-500">No template set</p>
              ) : (
                templates.map(cv => (
                  <div key={cv.id} className="p-3 bg-green-50 rounded border border-green-200 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{cv.filename}</p>
                      <p className="text-xs text-gray-500">Template</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCV(cv.id, cv.filename)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0 mt-0.5"
                      title="Delete"
                    >×</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Generated CVs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Generated ({generatedCVs.length})</h3>
            <div className="space-y-2">
              {generatedCVs.length === 0 ? (
                <p className="text-gray-500">No generated CVs yet</p>
              ) : (
                generatedCVs.map(cv => (
                  <div key={cv.id} className="p-3 bg-purple-50 rounded border border-purple-200 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{cv.filename}</p>
                      <p className="text-xs text-gray-600">{cv.created_at?.split('T')[0]}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCV(cv.id, cv.filename)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0 mt-0.5"
                      title="Delete"
                    >×</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Model Selector — compact with hint */}
        <div className="bg-white rounded-lg shadow px-6 py-4 mb-8">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">AI Model</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="── Claude (Anthropic) ──">
                {ALL_MODELS.filter(m => m.provider === 'Claude').map(model => {
                  const isEnabled = enabledModelIds.has(model.id);
                  return (
                    <option key={model.id} value={model.id} disabled={!isEnabled}>
                      {!isEnabled ? '🔒 ' : ''}{model.label} [{model.badge}] · {model.cost}{!isEnabled ? ' — disabled' : ''}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="── ChatGPT (OpenAI) ──">
                {ALL_MODELS.filter(m => m.provider === 'OpenAI').map(model => {
                  const isEnabled = enabledModelIds.has(model.id);
                  return (
                    <option key={model.id} value={model.id} disabled={!isEnabled}>
                      {!isEnabled ? '🔒 ' : ''}{model.label} [{model.badge}] · {model.cost}{!isEnabled ? ' — disabled' : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            <button
              onClick={handleSaveModel}
              disabled={savingModel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {savingModel ? 'Saving…' : 'Save'}
            </button>
          </div>
          {/* Hint line — updates as user changes selection */}
          {(() => {
            const m = ALL_MODELS.find(m => m.id === selectedModel);
            return m ? (
              <p className="mt-2 text-xs text-gray-500 pl-1">
                💡 {m.hint}
              </p>
            ) : null;
          })()}
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/generate')}
            disabled={baseCVs.length === 0}
            className="px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-center"
          >
            <p className="text-xl mb-1">⚡</p>
            <p className="font-bold">Generate CV</p>
            <p className="text-xs text-green-200 mt-1">Single JD</p>
          </button>
          <button
            onClick={() => navigate('/bulk-generate')}
            disabled={baseCVs.length === 0}
            className="px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-center"
          >
            <p className="text-xl mb-1">📦</p>
            <p className="font-bold">Bulk Generate</p>
            <p className="text-xs text-blue-200 mt-1">Multiple JDs at once</p>
          </button>
          <button
            onClick={() => navigate('/submissions')}
            className="px-6 py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 text-center"
          >
            <p className="text-xl mb-1">📋</p>
            <p className="font-bold">Submissions</p>
            <p className="text-xs text-purple-200 mt-1">Track your pipeline</p>
          </button>
        </div>

        {/* Recent Generations */}
        {generations.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Recent Generations</h3>
            <div className="space-y-2">
              {generations.slice(0, 5).map(gen => (
                <div key={gen.id} className="p-3 border border-gray-200 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{gen.status.toUpperCase()}</span>
                    <span className="text-sm text-gray-600">{gen.processing_time_ms}ms</span>
                  </div>
                  <p className="text-sm text-gray-600">{gen.created_at?.split('T')[0]}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
