import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvAPI, jdAPI, generationAPI } from '../services/api';
import type { AxiosError } from 'axios';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchPreview {
  coverage_pct: number;
  strategy: 'library_only' | 'library_plus_api' | 'full_api';
  jd_skills_total: number;
  covered_skills: string[];
  gap_skills: string[];
  library_size: number;
  estimated_api_calls: number;
  covered_preview: { skill: string; top_bullet: string; bullet_count: number }[];
}

interface DuplicateWarning {
  is_duplicate: boolean;
  original_user_email?: string;
  original_created_at?: string;
  original_jd_id?: string;
  cv_already_generated: boolean;
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const strategyLabel: Record<string, { label: string; color: string; desc: string }> = {
  library_only: {
    label: '🟢 Library Only',
    color: 'bg-green-100 text-green-800',
    desc: 'All required skills covered from your library — no extra AI calls needed.',
  },
  library_plus_api: {
    label: '🟡 Library + AI Patch',
    color: 'bg-yellow-100 text-yellow-800',
    desc: 'Most skills covered from library. One small AI call will fill the gaps.',
  },
  full_api: {
    label: '🔴 Full AI Generation',
    color: 'bg-red-100 text-red-800',
    desc: 'Library coverage too low. Full AI generation will be used.',
  },
};

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div
        className={`${color} h-3 rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GeneratePage() {
  const [cvs, setCvs] = useState<any[]>([]);
  const [templateCVs, setTemplateCVs] = useState<any[]>([]);
  const [selectedCVs, setSelectedCVs] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [jdText, setJdText] = useState('');

  // JD metadata (recruiter info)
  const [vendorName, setVendorName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [jdNotes, setJdNotes] = useState('');

  const [generationStatus, setGenerationStatus] = useState<any>(null);
  const [matchPreview, setMatchPreview] = useState<MatchPreview | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [loadingDupCheck, setLoadingDupCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'configure' | 'preview' | 'generating'>('configure');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadCVs();
  }, []);

  const loadCVs = async () => {
    try {
      const [baseResp, tmplResp] = await Promise.all([
        cvAPI.list('base'),
        cvAPI.list('template').catch(() => ({ data: { cvs: [] } })),
      ]);
      setCvs(baseResp.data.cvs);
      setTemplateCVs(tmplResp.data.cvs || []);
    } catch {
      toast.error('Failed to load CVs');
    }
  };

  const toggleCVSelection = (cvId: string) => {
    setSelectedCVs(prev => {
      if (prev.includes(cvId)) return prev.filter(id => id !== cvId);
      if (prev.length >= 3) { toast.error('Select up to 3 CVs'); return prev; }
      return [...prev, cvId];
    });
  };

  // ── JD blur: auto-check for duplicates when client email is set ────────────
  const handleJdBlur = async () => {
    if (!jdText.trim() || !clientEmail.trim()) return;
    setLoadingDupCheck(true);
    try {
      const resp = await jdAPI.checkDuplicate(jdText, clientEmail);
      const data = resp.data as DuplicateWarning;
      if (data.is_duplicate) {
        setDuplicateWarning(data);
        setDuplicateAcknowledged(false);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingDupCheck(false);
    }
  };

  // ── Check Library Coverage ─────────────────────────────────────────────────
  const handleCheckLibrary = async () => {
    if (!jdText.trim()) {
      toast.error('Please paste a job description first');
      return;
    }
    // Run dup check alongside library check
    await handleJdBlur();
    setLoadingMatch(true);
    try {
      const resp = await generationAPI.matchLibrary(jdText);
      setMatchPreview(resp.data as MatchPreview);
      setStep('preview');
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      toast.error(`Library check failed: ${axiosErr.response?.data?.detail ?? 'Unknown error'}`);
    } finally {
      setLoadingMatch(false);
    }
  };

  // ── Generate CV ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (selectedCVs.length === 0) {
      toast.error('Please select at least 1 base CV');
      return;
    }
    if (!jdText.trim()) {
      toast.error('Please paste a job description');
      return;
    }
    if (duplicateWarning?.is_duplicate && !duplicateAcknowledged) {
      toast.error('Please acknowledge the duplicate warning before proceeding');
      return;
    }

    setLoading(true);
    setStep('generating');

    try {
      const jdResponse = await jdAPI.create(
        jdText,
        undefined,   // roleTitle extracted server-side
        undefined,   // companyName
        vendorName || undefined,
        clientName || undefined,
        clientEmail || undefined,
        jdNotes || undefined,
      );
      const jdId = jdResponse.data.id;

      const genResponse = await generationAPI.generate(
        jdId,
        selectedCVs,
        selectedTemplate || undefined,
      );
      setGenerationStatus(genResponse.data);
      toast.success('CV generation started!');

      // Poll for completion
      let completed = false;
      let attempts = 0;
      while (!completed && attempts < 90) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResp = await generationAPI.getStatus(genResponse.data.id);
        setGenerationStatus(statusResp.data);
        if (statusResp.data.status === 'success' || statusResp.data.status === 'failed') {
          completed = true;
          if (statusResp.data.status === 'success') {
            toast.success('CV generated successfully!');
            if (statusResp.data.generated_cv_id) {
              setDownloadUrl(`/api/cv/${statusResp.data.generated_cv_id}/download`);
            }
          } else {
            toast.error(`Generation failed: ${statusResp.data.error_message}`);
          }
        }
        attempts++;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Generation failed');
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  const baseCVs = cvs.filter(cv => cv.cv_type === 'base');

  // ── Duplicate Warning Banner ───────────────────────────────────────────────
  const renderDuplicateWarning = () => {
    if (!duplicateWarning?.is_duplicate) return null;
    return (
      <div className="bg-amber-50 border border-amber-400 rounded-xl p-4 flex gap-4 items-start">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <p className="font-semibold text-amber-800 mb-1">Duplicate JD Detected</p>
          <p className="text-sm text-amber-700">{duplicateWarning.message}</p>
          {duplicateWarning.original_created_at && (
            <p className="text-xs text-amber-600 mt-1">
              Originally submitted on {new Date(duplicateWarning.original_created_at).toLocaleDateString()}
              {duplicateWarning.cv_already_generated && ' · A CV was already generated for this JD.'}
            </p>
          )}
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={duplicateAcknowledged}
              onChange={e => setDuplicateAcknowledged(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <span className="text-sm text-amber-800 font-medium">I understand and want to proceed anyway</span>
          </label>
        </div>
      </div>
    );
  };

  // ── STEP: Configure ────────────────────────────────────────────────────────
  const renderConfigureStep = () => (
    <div className="space-y-6">
      {renderDuplicateWarning()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left column — Select CVs */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-1">Step 1 — Select Base CVs</h2>
          <p className="text-sm text-gray-500 mb-4">Pick 1–3 of your existing CVs to draw from.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {baseCVs.length === 0 ? (
              <p className="text-gray-500 text-sm">No base CVs available. Upload at least one CV first.</p>
            ) : (
              baseCVs.map(cv => (
                <label key={cv.id} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selectedCVs.includes(cv.id)}
                    onChange={() => toggleCVSelection(cv.id)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <p className="font-medium text-sm">{cv.filename}</p>
                    <p className="text-xs text-gray-500">{cv.role_title || 'No title'} · {cv.seniority || ''}</p>
                  </div>
                  {selectedCVs.includes(cv.id) && <span className="text-blue-600 font-bold">✓</span>}
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">Selected: {selectedCVs.length} / 3</p>

          {/* Optional template */}
          {templateCVs.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold mb-2">Template CV (optional — sets output format)</p>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No template — keep original format</option>
                {templateCVs.map(t => (
                  <option key={t.id} value={t.id}>{t.filename}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right column — JD + Metadata */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Step 2 — Job Description</h2>
            <p className="text-sm text-gray-500 mb-3">Paste the full JD text and add client details.</p>
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              onBlur={handleJdBlur}
              placeholder="Paste the full job description here…"
              className="w-full h-44 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Recruiter / client metadata */}
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Client Details
              <span className="ml-2 text-xs font-normal text-gray-400">(optional — tracked in submission pipeline)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Vendor / Agency</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  placeholder="e.g. TechSearch Ltd"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Client Company</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Client Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => { setClientEmail(e.target.value); setDuplicateWarning(null); }}
                  onBlur={handleJdBlur}
                  placeholder="recruiter@client.com"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {loadingDupCheck && <p className="text-xs text-gray-400 mt-1">Checking for duplicates…</p>}
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Notes</label>
                <input
                  type="text"
                  value={jdNotes}
                  onChange={e => setJdNotes(e.target.value)}
                  placeholder="Any notes about this submission…"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleCheckLibrary}
          disabled={loadingMatch || !jdText.trim()}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMatch ? '⏳ Checking library…' : '🔍 Check My Library (preview coverage)'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={loading || selectedCVs.length === 0 || !jdText.trim() || (!!duplicateWarning?.is_duplicate && !duplicateAcknowledged)}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating…' : '⚡ Generate CV Directly'}
        </button>
      </div>
    </div>
  );

  // ── STEP: Library Preview ──────────────────────────────────────────────────
  const renderPreviewStep = () => {
    if (!matchPreview) return null;
    const { label, color, desc } = strategyLabel[matchPreview.strategy];
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {renderDuplicateWarning()}

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Library Coverage Report</h2>

          {/* Coverage bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">Library coverage</span>
              <span className="text-2xl font-bold text-gray-800">{matchPreview.coverage_pct}%</span>
            </div>
            <CoverageBar pct={matchPreview.coverage_pct} />
            <p className="text-xs text-gray-500 mt-1">
              {matchPreview.covered_skills.length} of {matchPreview.jd_skills_total} required skills found in your {matchPreview.library_size} saved bullets
            </p>
          </div>

          {/* Strategy badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-4 ${color}`}>
            {label}
          </div>
          <p className="text-sm text-gray-600 mb-4">{desc}</p>

          {/* API call estimate */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{matchPreview.estimated_api_calls}</p>
              <p className="text-xs text-gray-500">API calls needed</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{3 - matchPreview.estimated_api_calls}</p>
              <p className="text-xs text-gray-500">API calls saved</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{matchPreview.library_size}</p>
              <p className="text-xs text-gray-500">bullets in library</p>
            </div>
          </div>

          {/* Covered skills */}
          {matchPreview.covered_skills.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-green-700 mb-2">✅ Covered from library</p>
              <div className="flex flex-wrap gap-2">
                {matchPreview.covered_skills.map(s => (
                  <span key={s} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Gap skills */}
          {matchPreview.gap_skills.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠️ Gaps (will need AI generation)</p>
              <div className="flex flex-wrap gap-2">
                {matchPreview.gap_skills.map(s => (
                  <span key={s} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Sample bullets */}
          {matchPreview.covered_preview.length > 0 && (
            <details className="mt-2">
              <summary className="text-sm font-semibold cursor-pointer text-gray-700">
                📋 Sample matched bullets ({matchPreview.covered_preview.length} skills)
              </summary>
              <div className="mt-3 space-y-2">
                {matchPreview.covered_preview.slice(0, 5).map(p => (
                  <div key={p.skill} className="bg-gray-50 rounded-lg p-3">
                    <span className="text-xs font-bold text-blue-600 uppercase">{p.skill}</span>
                    <p className="text-xs text-gray-700 mt-1 italic">"{p.top_bullet}"</p>
                    <p className="text-xs text-gray-400">{p.bullet_count} matching bullet{p.bullet_count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => setStep('configure')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
          >
            ← Adjust Selection
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || selectedCVs.length === 0 || (!!duplicateWarning?.is_duplicate && !duplicateAcknowledged)}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating…' : `⚡ Generate CV (${matchPreview.estimated_api_calls} API call${matchPreview.estimated_api_calls !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    );
  };

  // ── STEP: Generation Status ────────────────────────────────────────────────
  const renderGeneratingStep = () => (
    <div className="bg-white rounded-xl shadow p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Generation Status</h2>

      {/* Status indicator */}
      <div className="mb-6">
        <div className={`flex items-center space-x-3 p-4 rounded-lg ${
          generationStatus?.status === 'success' ? 'bg-green-50' :
          generationStatus?.status === 'failed'  ? 'bg-red-50' : 'bg-blue-50'
        }`}>
          {(!generationStatus || generationStatus.status === 'pending' || generationStatus.status === 'processing') && (
            <>
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full flex-shrink-0" />
              <span className="text-lg font-semibold text-blue-700">Processing…</span>
            </>
          )}
          {generationStatus?.status === 'success' && (
            <>
              <span className="text-2xl">✅</span>
              <span className="text-lg font-semibold text-green-700">CV Generated!</span>
            </>
          )}
          {generationStatus?.status === 'failed' && (
            <>
              <span className="text-2xl">❌</span>
              <span className="text-lg font-semibold text-red-700">Failed</span>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      {generationStatus && (
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">Status</span>
            <span className="font-medium capitalize">{generationStatus.status}</span>
          </div>
          {generationStatus.processing_time_ms && (
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Processing time</span>
              <span className="font-medium">{(generationStatus.processing_time_ms / 1000).toFixed(1)}s</span>
            </div>
          )}
          {matchPreview && (
            <>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Strategy used</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${strategyLabel[matchPreview.strategy]?.color}`}>
                  {strategyLabel[matchPreview.strategy]?.label}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Library coverage</span>
                <span className="font-medium">{matchPreview.coverage_pct}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">API calls saved</span>
                <span className="font-medium text-green-600">{3 - matchPreview.estimated_api_calls}</span>
              </div>
            </>
          )}
          {generationStatus.error_message && (
            <p className="text-red-600 pt-2"><strong>Error:</strong> {generationStatus.error_message}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {downloadUrl && generationStatus?.status === 'success' && (
          <a
            href={downloadUrl}
            download
            className="w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            ⬇️ Download CV
          </a>
        )}
        {generationStatus?.status === 'success' && (
          <button
            onClick={() => navigate('/submissions')}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
          >
            📋 View Submission Pipeline
          </button>
        )}
        {generationStatus?.status !== 'processing' && generationStatus?.status !== 'pending' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold text-blue-700">Generate New CV</h1>

          {/* Step breadcrumb */}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            <span className={step === 'configure' ? 'font-bold text-blue-600' : ''}>Configure</span>
            <span>›</span>
            <span className={step === 'preview' ? 'font-bold text-blue-600' : ''}>Library Preview</span>
            <span>›</span>
            <span className={step === 'generating' ? 'font-bold text-blue-600' : ''}>Generating</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {step === 'configure'  && renderConfigureStep()}
        {step === 'preview'    && renderPreviewStep()}
        {step === 'generating' && renderGeneratingStep()}
      </div>
    </div>
  );
}
