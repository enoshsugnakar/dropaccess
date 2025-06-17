import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Create this file: app/api/test-db/route.ts
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'supabaseAdmin not configured' },
        { status: 500 }
      );
    }

    const { userId, action } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    console.log(`🧪 Test DB API called with action: ${action}, userId: ${userId}`);

    switch (action) {
      case 'check_user':
        return await checkUser(userId);
      
      case 'update_tier':
        return await updateUserTier(userId);
      
      case 'reset_user':
        return await resetUser(userId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check_user, update_tier, reset_user' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Test DB API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

async function checkUser(userId: string) {
  try {
    console.log(`🔍 Checking user: ${userId}`);
    
    // Test database connection
    const { data: dbTest, error: dbError } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (dbError) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: dbError
      });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      return NextResponse.json({
        success: false,
        userExists: false,
        error: userError.message,
        errorCode: userError.code
      });
    }

    return NextResponse.json({
      success: true,
      userExists: true,
      user: user,
      message: 'User found successfully'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Check user failed',
      details: error.message
    });
  }
}

async function updateUserTier(userId: string) {
  try {
    console.log(`📝 Updating user tier for: ${userId}`);
    
    // First check if user exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, subscription_tier, is_paid')
      .eq('id', userId)
      .single();

    if (checkError) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        details: checkError
      });
    }

    console.log(`👤 Current user state:`, existingUser);

    // Try to update user tier
    const updateData = {
      subscription_tier: 'individual',
      is_paid: true,
      subscription_status: 'active',
      dodo_customer_id: `test_customer_${Date.now()}`,
      updated_at: new Date().toISOString()
    };

    console.log(`📝 Attempting update with data:`, updateData);

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Update failed',
        details: updateError,
        attempted_data: updateData
      });
    }

    // Verify the update
    const { data: verifyUser, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'User tier updated successfully',
      before: existingUser,
      attempted_update: updateData,
      after: verifyUser,
      update_applied: verifyUser?.subscription_tier === 'individual'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Update user tier failed',
      details: error.message
    });
  }
}

async function resetUser(userId: string) {
  try {
    console.log(`🔄 Resetting user to free tier: ${userId}`);
    
    const resetData = {
      subscription_tier: 'free',
      is_paid: false,
      subscription_status: 'free',
      dodo_customer_id: null,
      subscription_ends_at: null,
      updated_at: new Date().toISOString()
    };

    const { data: resetUser, error: resetError } = await supabaseAdmin
      .from('users')
      .update(resetData)
      .eq('id', userId)
      .select('*')
      .single();

    if (resetError) {
      return NextResponse.json({
        success: false,
        error: 'Reset failed',
        details: resetError
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User reset to free tier successfully',
      user: resetUser
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Reset user failed',
      details: error.message
    });
  }
}