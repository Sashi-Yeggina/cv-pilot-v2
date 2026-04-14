import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cvAPI, generationAPI, useAuthStore } from '../services/api';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [cvs, setCvs] = useState<any[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadType, setUploadType] = useState('base');

  const navigate = useNavigate();
  const { email, logout } = useAuthStore();

  useEffect(() => {
    loadCVs();
    loadGenerations();
  }, []);

  const loadCVs = async () => {
    try {
      const response = await cvAPI.list();
      setCvs(response.data.cvs);
    } catch (error) {
      toast.error('Failed to load CVs');
    }
  };

  const loadGenerations = async () => {
    try {
      const response = await generationAPI.list();
      setGenerations(response.data.generations);
    } catch (error) {
      toast.error('Failed to load generations');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      await cvAPI.upload(file, uploadType);
      toast.success('CV uploaded successfully!');
      loadCVs();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingFile(false);
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
                  {uploadingFile ? 'Uploading...' : 'Upload DOCX File'}
                </button>
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
                  <div key={cv.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="font-medium text-sm">{cv.filename}</p>
                    <p className="text-xs text-gray-600">{cv.role_title || 'No title'}</p>
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
                  <div key={cv.id} className="p-3 bg-green-50 rounded border border-green-200">
                    <p className="font-medium text-sm">{cv.filename}</p>
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
                  <div key={cv.id} className="p-3 bg-purple-50 rounded border border-purple-200">
                    <p className="font-medium text-sm">{cv.filename}</p>
                    <p className="text-xs text-gray-600">{cv.created_at?.split('T')[0]}</p>
                  </div>
                ))
              )}
            </div>
          </div>
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
