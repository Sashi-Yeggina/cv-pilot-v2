import React from 'react';
import { Check } from 'lucide-react';

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

interface ModelCardProps {
  model: Model;
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect: (modelId: string) => void;
  showRecommendation?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isSelected,
  isDisabled = false,
  onSelect,
  showRecommendation = false,
}) => {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'budget':
      case 'standard':
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
      case 'balanced':
      case 'premium':
        return 'bg-purple-50 border-purple-200 hover:bg-purple-100';
      case 'elite':
        return 'bg-gold-50 border-gold-200 hover:bg-gold-100';
      default:
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    return provider === 'claude'
      ? 'bg-orange-100 text-orange-800'
      : 'bg-cyan-100 text-cyan-800';
  };

  const handleClick = () => {
    if (!isDisabled) {
      onSelect(model.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative p-4 rounded-lg border-2 transition-all cursor-pointer
        ${getTierColor(model.tier)}
        ${isSelected ? 'border-green-500 shadow-lg scale-105' : 'border-gray-200'}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
          <Check size={16} className="text-white" />
        </div>
      )}

      {/* Recommendation Badge */}
      {showRecommendation && !isDisabled && (
        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          Recommended
        </div>
      )}

      {/* Provider Badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">{model.label}</h3>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded ml-2 whitespace-nowrap ${getProviderBadgeColor(model.provider)}`}>
          {model.provider === 'claude' ? 'Claude' : 'ChatGPT'}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mb-3 min-h-[2rem]">
        {model.description}
      </p>

      {/* Cost */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <span className="text-xs text-gray-700 font-medium">Cost:</span>
        <span className="text-xs font-semibold text-gray-900">{model.approx_cost}</span>
      </div>

      {/* Tier Label */}
      <div className="mt-2 text-xs text-gray-600 capitalize">
        {model.tier} • {model.provider}
      </div>

      {/* Disabled State */}
      {isDisabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
          <span className="text-white font-semibold text-xs">Disabled</span>
        </div>
      )}
    </div>
  );
};

export default ModelCard;
