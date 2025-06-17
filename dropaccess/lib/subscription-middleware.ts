import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { subscriptionGuard, type SubscriptionCheck, type UpgradePrompt } from '@/lib/subscription-guard';

// Types for middleware responses
export interface LimitCheckResult {
  allowed: boolean;
  userId?: string;
  error?: string;
  upgradePrompt?: UpgradePrompt;
  statusCode?: number;
}

// Helper function to extract user ID from request
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // Try to get user ID from Authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (!supabaseAdmin) {
        console.error('Supabase admin client not available');
        return null;
      }
      
      // Verify token with Supabase
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }
      
      return user.id;
    }

    // Try to get user ID from request body
    const body = await request.json();
    if (body.userId) {
      return body.userId;
    }

    // Try to get from URL params
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('userId');
    if (userIdParam) {
      return userIdParam;
    }

    return null;
  } catch (error) {
    console.error('Error extracting user ID from request:', error);
    return null;
  }
}

// Middleware class for subscription enforcement
class SubscriptionMiddleware {
  
  /**
   * Check if user can create a drop (for API routes)
   */
  async checkDropCreationLimits(
    userId: string,
    recipientCount: number,
    fileSizeMb: number = 0
  ): Promise<LimitCheckResult> {
    try {
      const result = await subscriptionGuard.checkDropCreation(userId, recipientCount, fileSizeMb);
      
      if (!result.allowed) {
        return {
          allowed: false,
          userId,
          error: result.reason,
          upgradePrompt: result.upgradePrompt,
          statusCode: 403
        };
      }

      return {
        allowed: true,
        userId
      };
    } catch (error) {
      console.error('Error checking drop creation limits:', error);
      return {
        allowed: false,
        userId,
        error: 'System error checking limits',
        statusCode: 500
      };
    }
  }

  /**
   * Check feature access for API routes
   */
  async checkFeatureAccessLimits(
    userId: string,
    feature: string
  ): Promise<LimitCheckResult> {
    try {
      const result = await subscriptionGuard.checkFeatureAccess(userId, feature);
      
      if (!result.hasAccess) {
        return {
          allowed: false,
          userId,
          error: result.reason || `Access denied for feature: ${feature}`,
          statusCode: 403
        };
      }

      return {
        allowed: true,
        userId
      };
    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        allowed: false,
        userId,
        error: 'System error checking feature access',
        statusCode: 500
      };
    }
  }

  /**
   * Generic middleware wrapper for API routes
   */
  async withSubscriptionCheck<T extends any[]>(
    request: NextRequest,
    handler: (userId: string, ...args: T) => Promise<NextResponse>,
    checkFunction: (userId: string, ...args: T) => Promise<LimitCheckResult>,
    ...args: T
  ): Promise<NextResponse> {
    try {
      // Extract user ID from request
      const userId = await getUserIdFromRequest(request);
      
      if (!userId) {
        return NextResponse.json(
          { 
            error: 'Authentication required',
            message: 'User ID not found in request' 
          },
          { status: 401 }
        );
      }

      // Check subscription limits
      const limitCheck = await checkFunction(userId, ...args);
      
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: limitCheck.error,
            upgrade_required: !!limitCheck.upgradePrompt,
            upgrade_prompt: limitCheck.upgradePrompt,
            user_id: userId
          },
          { status: limitCheck.statusCode || 403 }
        );
      }

      // Limits passed, call the actual handler
      return await handler(userId, ...args);
      
    } catch (error) {
      console.error('Error in subscription middleware:', error);
      return NextResponse.json(
        { 
          error: 'Internal server error',
          message: 'Error checking subscription limits' 
        },
        { status: 500 }
      );
    }
  }

  /**
   * Middleware specifically for drop creation endpoints
   */
  async withDropCreationCheck(
    request: NextRequest,
    handler: (userId: string, recipientCount: number, fileSizeMb: number) => Promise<NextResponse>,
    recipientCount: number,
    fileSizeMb: number = 0
  ): Promise<NextResponse> {
    return this.withSubscriptionCheck(
      request,
      handler,
      this.checkDropCreationLimits.bind(this),
      recipientCount,
      fileSizeMb
    );
  }

  /**
   * Middleware for feature access endpoints
   */
  async withFeatureCheck(
    request: NextRequest,
    handler: (userId: string, feature: string) => Promise<NextResponse>,
    feature: string
  ): Promise<NextResponse> {
    return this.withSubscriptionCheck(
      request,
      handler,
      this.checkFeatureAccessLimits.bind(this),
      feature
    );
  }
}

// Export singleton instance
export const subscriptionMiddleware = new SubscriptionMiddleware();

// Convenience functions for common checks
export async function requireDropCreationLimits(
  request: NextRequest,
  recipientCount: number,
  fileSizeMb: number = 0
): Promise<LimitCheckResult> {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    return {
      allowed: false,
      error: 'Authentication required',
      statusCode: 401
    };
  }

  return await subscriptionMiddleware.checkDropCreationLimits(userId, recipientCount, fileSizeMb);
}

export async function requireFeatureAccess(
  request: NextRequest,
  feature: string
): Promise<LimitCheckResult> {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    return {
      allowed: false,
      error: 'Authentication required',
      statusCode: 401
    };
  }

  return await subscriptionMiddleware.checkFeatureAccessLimits(userId, feature);
}

// Higher-order function for protecting API routes
export function withSubscriptionGuard<T extends any[]>(
  checkFunction: (userId: string, ...args: T) => Promise<LimitCheckResult>
) {
  return function (
    handler: (request: NextRequest, userId: string, ...args: T) => Promise<NextResponse>
  ) {
    return async function (request: NextRequest, ...args: T): Promise<NextResponse> {
      try {
        // Extract user ID
        const userId = await getUserIdFromRequest(request);
        
        if (!userId) {
          return NextResponse.json(
            { 
              error: 'Authentication required',
              message: 'Please log in to continue' 
            },
            { status: 401 }
          );
        }

        // Check limits
        const limitCheck = await checkFunction(userId, ...args);
        
        if (!limitCheck.allowed) {
          return NextResponse.json(
            {
              error: limitCheck.error,
              upgrade_required: !!limitCheck.upgradePrompt,
              upgrade_prompt: limitCheck.upgradePrompt,
              user_id: userId,
              limit_check_failed: true
            },
            { status: limitCheck.statusCode || 403 }
          );
        }

        // All checks passed, call handler
        return await handler(request, userId, ...args);
        
      } catch (error) {
        console.error('Error in subscription guard wrapper:', error);
        return NextResponse.json(
          { 
            error: 'Internal server error',
            message: 'Error processing request' 
          },
          { status: 500 }
        );
      }
    };
  };
}

// Specific guard functions for common use cases
export const withDropCreationGuard = withSubscriptionGuard(
  async (userId: string, recipientCount: number, fileSizeMb: number = 0) => {
    return await subscriptionMiddleware.checkDropCreationLimits(userId, recipientCount, fileSizeMb);
  }
);

export const withFeatureGuard = (feature: string) => withSubscriptionGuard(
  async (userId: string) => {
    return await subscriptionMiddleware.checkFeatureAccessLimits(userId, feature);
  }
);

// Export all middleware functions
export {
  
  getUserIdFromRequest
};