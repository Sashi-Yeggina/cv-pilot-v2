import { create } from 'zustand';

export interface Model {
  id: string;
  label: string;
  provider: 'claude' | 'openai';
  description: string;
  tier: 'standard' | 'premium' | 'elite' | 'budget' | 'balanced';
  approx_cost: string;
  is_enabled?: boolean;
  is_disabled?: boolean;
}

export interface ModelStore {
  // State
  selectedModel: Model | null;
  availableModels: Model[];
  userTier: 'free' | 'pro' | 'enterprise';
  estimatedCost: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedModel: (model: Model | null) => void;
  setSelectedModelById: (modelId: string) => void;
  setAvailableModels: (models: Model[]) => void;
  setUserTier: (tier: 'free' | 'pro' | 'enterprise') => void;
  setEstimatedCost: (cost: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadModels: (models: Model[]) => void;
  getSelectedModelCost: () => number;
  isModelAvailable: (modelId: string) => boolean;
  getModelById: (modelId: string) => Model | undefined;
  resetSelection: () => void;
}

const DEFAULT_MODEL_ID = 'claude-haiku-4-5';

export const useModelStore = create<ModelStore>((set, get) => ({
  // Initial state
  selectedModel: null,
  availableModels: [],
  userTier: 'free',
  estimatedCost: 0,
  isLoading: false,
  error: null,

  // Actions
  setSelectedModel: (model) => {
    set({ selectedModel: model });
    if (model) {
      // Parse cost from approx_cost string (e.g., "$0.0008 per CV" -> 0.0008)
      const costMatch = model.approx_cost.match(/\$([\d.]+)/);
      if (costMatch) {
        set({ estimatedCost: parseFloat(costMatch[1]) });
      }
    }
  },

  setSelectedModelById: (modelId) => {
    const model = get().availableModels.find(m => m.id === modelId);
    if (model) {
      get().setSelectedModel(model);
    }
  },

  setAvailableModels: (models) => {
    set({ availableModels: models });
    // Auto-select default model if not already selected
    const currentSelected = get().selectedModel;
    if (!currentSelected && models.length > 0) {
      const defaultModel = models.find(m => m.id === DEFAULT_MODEL_ID) || models[0];
      get().setSelectedModel(defaultModel);
    }
  },

  setUserTier: (tier) => {
    set({ userTier: tier });
  },

  setEstimatedCost: (cost) => {
    set({ estimatedCost: cost });
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  loadModels: (models) => {
    set({ availableModels: models });
    // Ensure a model is selected
    const currentSelected = get().selectedModel;
    if (!currentSelected && models.length > 0) {
      const defaultModel = models.find(m => m.id === DEFAULT_MODEL_ID) || models[0];
      get().setSelectedModel(defaultModel);
    }
  },

  getSelectedModelCost: () => {
    const selected = get().selectedModel;
    if (!selected) return 0;
    const costMatch = selected.approx_cost.match(/\$([\d.]+)/);
    return costMatch ? parseFloat(costMatch[1]) : 0;
  },

  isModelAvailable: (modelId) => {
    const model = get().availableModels.find(m => m.id === modelId);
    return model ? !model.is_disabled && model.is_enabled !== false : false;
  },

  getModelById: (modelId) => {
    return get().availableModels.find(m => m.id === modelId);
  },

  resetSelection: () => {
    const models = get().availableModels;
    const defaultModel = models.find(m => m.id === DEFAULT_MODEL_ID) || models[0];
    set({
      selectedModel: defaultModel || null,
      estimatedCost: 0,
      error: null,
    });
  },
}));

// Helper hook for easier usage
export const useSelectedModel = () => {
  const selectedModel = useModelStore((state) => state.selectedModel);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  return { selectedModel, setSelectedModel };
};

// Helper hook for model list
export const useAvailableModels = () => {
  const availableModels = useModelStore((state) => state.availableModels);
  const setAvailableModels = useModelStore((state) => state.setAvailableModels);
  return { availableModels, setAvailableModels };
};

// Helper hook for loading state
export const useModelLoading = () => {
  const isLoading = useModelStore((state) => state.isLoading);
  const error = useModelStore((state) => state.error);
  const setIsLoading = useModelStore((state) => state.setIsLoading);
  const setError = useModelStore((state) => state.setError);
  return { isLoading, error, setIsLoading, setError };
};

export default useModelStore;
