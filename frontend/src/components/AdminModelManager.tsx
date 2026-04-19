import React, { useEffect, useState } from 'react';
import { ChevronDown, Edit2, Save, X } from 'lucide-react';

interface ModelSettings {
  id: string;
  model_id: string;
  provider: 'claude' | 'openai';
  model_name: string;
  is_enabled: boolean;
  is_visible_to_free_tier: boolean;
  is_visible_to_pro_tier: boolean;
  is_visible_to_enterprise_tier: boolean;
  cost_per_cv: number;
  estimated_speed_seconds: number;
  quality_tier: 'budget' | 'balanced' | 'premium';
  recommendation_text: string | null;
  disabled_reason: string | null;
}

interface UserModel {
  user_id: string;
  email: string;
  full_name: string;
  current_model: string;
  model_label: string;
  updated_at: string;
  updated_by: string;
}

interface AdminModelManagerProps {
  adminEmail: string;
  onSave?: () => void;
}

export const AdminModelManager: React.FC<AdminModelManagerProps> = ({
  adminEmail,
  onSave,
}) => {
  const [models, setModels] = useState<ModelSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/admin/models', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
        setError(null);
      } else {
        setError('Failed to load models');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelToggle = async (modelId: string, newStatus: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/admin/models/${modelId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_enabled: newStatus,
          disabled_reason: newStatus ? null : 'Disabled by admin',
        }),
      });

      if (response.ok) {
        setModels(models.map(m =>
          m.id === modelId ? { ...m, is_enabled: newStatus } : m
        ));
        onSave?.();
      } else {
        setError('Failed to update model');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    return provider === 'claude'
      ? 'bg-orange-100 text-orange-800'
      : 'bg-cyan-100 text-cyan-800';
  };

  const getStatusBadgeColor = (enabled: boolean) => {
    return enabled
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-600">Loading models...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Model Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Enable/disable models and manage tier visibility
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Models Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Tier Visibility
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                  Speed
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {models.map((model) => (
                <React.Fragment key={model.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {model.model_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getProviderBadgeColor(model.provider)}`}>
                        {model.provider === 'claude' ? 'Claude' : 'OpenAI'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusBadgeColor(model.is_enabled)}`}>
                        {model.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      ${model.cost_per_cv.toFixed(4)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {model.is_visible_to_free_tier && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Free
                          </span>
                        )}
                        {model.is_visible_to_pro_tier && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            Pro
                          </span>
                        )}
                        {model.is_visible_to_enterprise_tier && (
                          <span className="text-xs bg-gold-100 text-gold-800 px-2 py-1 rounded">
                            Enterprise
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {model.estimated_speed_seconds}s
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setExpandedModelId(
                          expandedModelId === model.id ? null : model.id
                        )}
                        className="text-gray-600 hover:text-gray-900 p-2"
                        title="Show details"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${
                            expandedModelId === model.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleModelToggle(model.id, !model.is_enabled)}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                          model.is_enabled
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {model.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedModelId === model.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Recommendation Text
                            </label>
                            <p className="text-sm text-gray-600">
                              {model.recommendation_text || 'No recommendation set'}
                            </p>
                          </div>
                          {model.disabled_reason && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Disabled Reason
                              </label>
                              <p className="text-sm text-gray-600">
                                {model.disabled_reason}
                              </p>
                            </div>
                          )}
                          <div className="pt-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                              Model ID
                            </label>
                            <code className="text-xs bg-gray-200 px-2 py-1 rounded font-mono">
                              {model.model_id}
                            </code>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">
            Total Models
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {models.length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">
            Enabled
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {models.filter(m => m.is_enabled).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">
            Disabled
          </p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {models.filter(m => !m.is_enabled).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">
            Avg. Cost
          </p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            ${(models.reduce((sum, m) => sum + m.cost_per_cv, 0) / models.length).toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminModelManager;
