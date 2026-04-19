import React, { useEffect, useState } from 'react';
import ModelCard from './ModelCard';

interface Model {
  id: string;
  label: string;
  provider: 'claude' | 'openai';
  description: string;
  tier: 'standard' | 'premium' | 'elite' | 'budget' | 'balanced';
  approx_cost: string;
  is_enabled?: boolean;
  is_disabled?: boolean;
}

interface ModelSelectorProps {
  models: Model[];
  selectedModelId: string;
  onModelSelect: (modelId: string) => void;
  userTier?: 'free' | 'pro' | 'enterprise';
  showOnlyEnabled?: boolean;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onModelSelect,
  userTier = 'free',
  showOnlyEnabled = true,
  className = '',
}) => {
  const [filteredModels, setFilteredModels] = useState<Model[]>(models);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  useEffect(() => {
    // Filter models based on tier and enabled status
    let filtered = models;

    if (showOnlyEnabled) {
      filtered = filtered.filter(m => !m.is_disabled && m.is_enabled !== false);
    }

    // Show appropriate models based on user tier
    if (userTier === 'free') {
      filtered = filtered.filter(m =>
        m.tier === 'budget' || m.tier === 'standard'
      );
    } else if (userTier === 'pro') {
      filtered = filtered.filter(m =>
        m.tier === 'budget' || m.tier === 'standard' || m.tier === 'balanced' || m.tier === 'premium'
      );
    }
    // enterprise gets all models

    setFilteredModels(filtered);

    // Set initially selected model
    const selected = filtered.find(m => m.id === selectedModelId) || filtered[0];
    setSelectedModel(selected || null);
  }, [models, selectedModelId, userTier, showOnlyEnabled]);

  const handleModelChange = (modelId: string) => {
    const model = filteredModels.find(m => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      onModelSelect(modelId);
    }
  };

  // Group models by provider for better organization
  const claudeModels = filteredModels.filter(m => m.provider === 'claude');
  const openaiModels = filteredModels.filter(m => m.provider === 'openai');

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Select AI Model
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {selectedModel && (
            <>
              Currently using <span className="font-semibold">{selectedModel.label}</span>
              {' '}({selectedModel.approx_cost})
            </>
          )}
        </p>
      </div>

      <div className="space-y-6">
        {/* Claude Models Section */}
        {claudeModels.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
              Claude (Anthropic)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {claudeModels.map(model => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModelId === model.id}
                  isDisabled={model.is_disabled || model.is_enabled === false}
                  onSelect={handleModelChange}
                  showRecommendation={model.id === 'claude-haiku-4-5'}
                />
              ))}
            </div>
          </div>
        )}

        {/* OpenAI Models Section */}
        {openaiModels.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full mr-2"></span>
              ChatGPT (OpenAI)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {openaiModels.map(model => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModelId === model.id}
                  isDisabled={model.is_disabled || model.is_enabled === false}
                  onSelect={handleModelChange}
                  showRecommendation={model.id === 'gpt-3.5-turbo'}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Tip:</span> Different models have different costs and speeds.
          Start with Haiku (fastest, cheapest) and upgrade to Sonnet or Opus for better quality on complex roles.
        </p>
      </div>

      {/* Empty State */}
      {filteredModels.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">
            No models available for your account tier. Please contact support.
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
