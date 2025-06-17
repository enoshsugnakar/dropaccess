'use client'

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { 
  checkDropCreation, 
  checkFeatureAccess, 
  getUsageStatus,
  type SubscriptionCheck,
  type FeatureAccess,
  type UpgradePrompt
} from '@/lib/subscription-guard';

// Hook for checking if user can create a drop
export function useDropCreationCheck() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const checkCreation = useCallback(async (recipientCount: number, fileSizeMb: number = 0): Promise<SubscriptionCheck> => {
    if (!user?.id) {
      return {
        allowed: false,
        reason: 'User not authenticated'
      };
    }

    setLoading(true);
    try {
      const result = await checkDropCreation(user.id, recipientCount, fileSizeMb);
      return result;
    } catch (error) {
      console.error('Error checking drop creation:', error);
      return {
        allowed: false,
        reason: 'Error checking limits'
      };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return { checkCreation, loading };
}

// Hook for checking feature access
export function useFeatureAccess(feature: string) {
  const { user } = useAuth();
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      if (!user?.id) {
        setAccess({
          hasAccess: false,
          feature,
          reason: 'User not authenticated'
        });
        setLoading(false);
        return;
      }

      try {
        const result = await checkFeatureAccess(user.id, feature);
        setAccess(result);
      } catch (error) {
        console.error('Error checking feature access:', error);
        setAccess({
          hasAccess: false,
          feature,
          reason: 'Error checking access'
        });
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [user?.id, feature]);

  const recheckAccess = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const result = await checkFeatureAccess(user.id, feature);
      setAccess(result);
    } catch (error) {
      console.error('Error rechecking feature access:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, feature]);

  return { access, loading, recheckAccess };
}

// Hook for usage status with warnings
export function useUsageStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await getUsageStatus(user.id);
      setStatus(result);
    } catch (err) {
      console.error('Error getting usage status:', err);
      setError(err instanceof Error ? err.message : 'Error getting usage status');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return { 
    status, 
    loading, 
    error, 
    refreshStatus,
    warnings: status?.warnings || [],
    percentages: status?.percentages || {},
    tier: status?.tier || 'free'
  };
}

// Hook for specific feature checks (convenience hooks)
export function useAdvancedAnalytics() {
  return useFeatureAccess('advanced_analytics');
}

export function useCustomBranding() {
  return useFeatureAccess('custom_branding');
}

export function useDataExport() {
  return useFeatureAccess('export_data');
}

export function useLargeFileUploads() {
  return useFeatureAccess('large_file_uploads');
}

// Hook for upgrade prompts management
export function useUpgradePrompts() {
  const { warnings } = useUsageStatus();
  const [dismissedPrompts, setDismissedPrompts] = useState<string[]>([]);

  const dismissPrompt = useCallback((promptId: string) => {
    setDismissedPrompts(prev => [...prev, promptId]);
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissedPrompts([]);
  }, []);

  // Filter out dismissed prompts
  const activePrompts = warnings.filter((warning: UpgradePrompt & { id?: string }) => {
    const promptId = warning.id || `${warning.type}-${warning.title}`;
    return !dismissedPrompts.includes(promptId);
  });

  return {
    prompts: activePrompts,
    dismissPrompt,
    clearDismissed,
    hasHighPriorityPrompts: activePrompts.some((p: UpgradePrompt) => p.urgency === 'high'),
    hasMediumPriorityPrompts: activePrompts.some((p: UpgradePrompt) => p.urgency === 'medium')
  };
}

// Hook for limit checking with real-time validation
export function useLimitChecker() {
  const { user } = useAuth();
  const { checkCreation } = useDropCreationCheck();

  const checkFileSize = useCallback(async (fileSizeMb: number): Promise<SubscriptionCheck> => {
    return await checkCreation(1, fileSizeMb);
  }, [checkCreation]);

  const checkRecipientCount = useCallback(async (recipientCount: number): Promise<SubscriptionCheck> => {
    return await checkCreation(recipientCount, 0);
  }, [checkCreation]);

  const checkBothLimits = useCallback(async (recipientCount: number, fileSizeMb: number): Promise<SubscriptionCheck> => {
    return await checkCreation(recipientCount, fileSizeMb);
  }, [checkCreation]);

  return {
    checkFileSize,
    checkRecipientCount,
    checkBothLimits
  };
}

// Hook for upgrade flow
export function useUpgradeFlow() {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<{
    trigger: string;
    feature?: string;
    prompt?: UpgradePrompt;
  } | null>(null);

  const triggerUpgrade = useCallback((context: {
    trigger: string;
    feature?: string;
    prompt?: UpgradePrompt;
  }) => {
    setUpgradeContext(context);
    setIsUpgradeModalOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setUpgradeContext(null);
  }, []);

  return {
    isUpgradeModalOpen,
    upgradeContext,
    triggerUpgrade,
    closeUpgrade
  };
}

// Helper hook for form validation
export function useFormLimitValidation() {
  const { checkBothLimits } = useLimitChecker();
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    upgradePrompt?: UpgradePrompt;
  }>({
    isValid: true,
    errors: [],
    warnings: []
  });

  const validateLimits = useCallback(async (formData: {
    recipients: string[];
    fileSize?: number;
  }) => {
    const recipientCount = formData.recipients.length;
    const fileSizeMb = formData.fileSize || 0;

    const result = await checkBothLimits(recipientCount, fileSizeMb);

    if (result.allowed) {
      setValidationState({
        isValid: true,
        errors: [],
        warnings: []
      });
    } else {
      setValidationState({
        isValid: false,
        errors: [result.reason || 'Limit exceeded'],
        warnings: [],
        upgradePrompt: result.upgradePrompt
      });
    }

    return result;
  }, [checkBothLimits]);

  return {
    validationState,
    validateLimits,
    clearValidation: () => setValidationState({
      isValid: true,
      errors: [],
      warnings: []
    })
  };
}