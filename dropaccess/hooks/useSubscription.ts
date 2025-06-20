'use client'

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

// Use your existing API instead of subscription-guard
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
      
      // Use your existing /api/usage endpoint
      const response = await fetch(`/api/usage?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }
      
      const data = await response.json();
      
      // Transform to expected format
      const transformedStatus = {
        usage: data.monthly,
        limits: {
          drops_per_month: data.limits.drops,
          recipients_per_drop: data.limits.recipients, 
          file_size_mb: data.limits.file_size_mb,
          storage_total_mb: data.limits.storage
        },
        tier: data.subscription.tier,
        warnings: [],
        percentages: {
          drops: data.limits.drops === -1 ? 0 : (data.monthly.drops_created / data.limits.drops) * 100,
          storage: data.limits.storage === -1 ? 0 : (data.monthly.storage_used_mb / data.limits.storage) * 100
        }
      };
      
      setStatus(transformedStatus);
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

export function useFormLimitValidation() {
  const { status } = useUsageStatus();
  const [validationState, setValidationState] = useState<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  upgradePrompt?: any;
}>({
  isValid: true,
  errors: [],
  warnings: []
});

  const validateLimits = useCallback(async (formData: {
    recipients: string[];
    fileSize?: number;
  }) => {
    if (!status) {
      return { allowed: true };
    }

    const recipientCount = formData.recipients.length;
    const fileSizeMb = formData.fileSize || 0;
    const limits = status.limits;

    // Check recipient limit
    if (limits.recipients_per_drop !== -1 && recipientCount > limits.recipients_per_drop) {
      const upgradePrompt = {
        type: 'hard',
        title: 'Too many recipients',
        description: `Your plan allows up to ${limits.recipients_per_drop} recipients. You're trying to add ${recipientCount}.`,
        cta: status.tier === 'free' ? 'Upgrade to Individual' : 'Upgrade to Business'
      };

      setValidationState({
        isValid: false,
        errors: [`Too many recipients (${recipientCount}/${limits.recipients_per_drop})`],
        warnings: [],
        upgradePrompt
      });

      return { allowed: false, upgradePrompt };
    }

    // Check file size limit
    if (limits.file_size_mb !== -1 && fileSizeMb > limits.file_size_mb) {
      const upgradePrompt = {
        type: 'hard',
        title: 'File too large',
        description: `Your plan allows files up to ${limits.file_size_mb}MB. This file is ${fileSizeMb.toFixed(1)}MB.`,
        cta: status.tier === 'free' ? 'Upgrade to Individual' : 'Upgrade to Business'
      };

      setValidationState({
        isValid: false,
        errors: [`File too large (${fileSizeMb.toFixed(1)}MB/${limits.file_size_mb}MB)`],
        warnings: [],
        upgradePrompt
      });

      return { allowed: false, upgradePrompt };
    }

    // Check drops limit
    if (limits.drops_per_month !== -1 && status.usage.drops_created >= limits.drops_per_month) {
      const upgradePrompt = {
        type: 'hard',
        title: 'Monthly drop limit reached',
        description: `You've used all ${limits.drops_per_month} drops for this month.`,
        cta: status.tier === 'free' ? 'Upgrade to Individual' : 'Upgrade to Business'
      };

      setValidationState({
        isValid: false,
        errors: [`Monthly drop limit reached (${status.usage.drops_created}/${limits.drops_per_month})`],
        warnings: [],
        upgradePrompt
      });

      return { allowed: false, upgradePrompt };
    }

    // All checks passed
    setValidationState({
      isValid: true,
      errors: [],
      warnings: []
    });

    return { allowed: true };
  }, [status]);

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

export function useDropCreationCheck() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const checkCreation = useCallback(async (recipientCount: number, fileSizeMb: number = 0) => {
    if (!user?.id) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    setLoading(true);
    try {
      // Use the existing API route you already have
      const response = await fetch('/api/drops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: 'test',
          dropType: 'url',
          maskedUrl: 'https://example.com',
          recipients: Array(recipientCount).fill('test@example.com').join(','),
          fileSizeMb: fileSizeMb,
          // Add a test flag to not actually create
          testOnly: true
        })
      });

      const result = await response.json();
      
      if (response.status === 403 && result.upgrade_required) {
        return {
          allowed: false,
          reason: result.error,
          upgradePrompt: result.upgrade_prompt
        };
      }

      return { allowed: response.ok };
    } catch (error) {
      console.error('Error checking drop creation:', error);
      return { allowed: false, reason: 'Error checking limits' };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return { checkCreation, loading };
}

export function useFeatureAccess(feature: string) {
  const { status } = useUsageStatus();
  
  const access = {
    hasAccess: true, // Default to true for now
    feature,
    reason: undefined
  };

  return {
    access,
    loading: false,
    recheckAccess: () => Promise.resolve()
  };
}