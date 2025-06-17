import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { subscriptionGuard } from '@/lib/subscription-guard';
import { updateUsageAfterDrop } from '@/lib/usageTracking';

export async function POST(request: NextRequest) {
  console.log('🚀 Drop creation API started');
  
  try {
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      userId,
      name,
      description,
      dropType,
      maskedUrl,
      recipients,
      timerMode,
      defaultTimeLimitHours,
      verificationDeadline,
      creationExpiry,
      filePath,
      fileSizeMb = 0
    } = body;

    console.log('📝 Drop creation request:', { 
      userId, 
      name, 
      dropType, 
      recipientCount: recipients?.length || 0,
      fileSizeMb 
    });

    // Validate required fields
    if (!userId || !name || !dropType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, dropType' },
        { status: 400 }
      );
    }

    // Parse recipients
    const recipientEmails = recipients ? recipients.split(',').map((email: string) => email.trim()).filter(Boolean) : [];
    const recipientCount = recipientEmails.length;

    // ===== SUBSCRIPTION LIMIT CHECK =====
    console.log('🔒 Checking subscription limits...');
    const limitCheck = await subscriptionGuard.checkDropCreation(userId, recipientCount, fileSizeMb);
    
    if (!limitCheck.allowed) {
      console.log('❌ Subscription limit exceeded:', limitCheck.reason);
      return NextResponse.json(
        {
          error: limitCheck.reason,
          upgrade_required: true,
          upgrade_prompt: limitCheck.upgradePrompt,
          current_usage: limitCheck.currentUsage,
          limits: limitCheck.limits
        },
        { status: 403 }
      );
    }

    console.log('✅ Subscription limits passed');

    // Validate drop type specific fields
    if (dropType === 'url' && !maskedUrl) {
      return NextResponse.json(
        { error: 'Masked URL is required for URL drops' },
        { status: 400 }
      );
    }

    // Calculate expiry dates
    let expiryDate: Date | null = null;
    let globalExpiryDate: Date | null = null;

    if (timerMode === 'creation' && creationExpiry) {
      expiryDate = new Date(creationExpiry);
      if (isNaN(expiryDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid creation expiry date' },
          { status: 400 }
        );
      }
    }

    if (timerMode === 'verification' && verificationDeadline) {
      globalExpiryDate = new Date(verificationDeadline);
      if (isNaN(globalExpiryDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid verification deadline' },
          { status: 400 }
        );
      }
    }

    // Create drop payload
    const dropPayload = {
      owner_id: userId,
      name: name.trim(),
      drop_type: dropType,
      file_path: dropType === 'file' ? filePath : null,
      masked_url: dropType === 'url' ? maskedUrl.trim() : null,
      description: description?.trim() || null,
      one_time_access: false,
      is_active: true,
      expires_at: expiryDate?.toISOString() || null,
      default_time_limit_hours: timerMode === 'verification' ? defaultTimeLimitHours : null,
      global_expires_at: globalExpiryDate?.toISOString() || null
    };

    console.log("Creating drop with payload:", dropPayload);

    // Insert drop into database
    const { data: dropData, error: dropError } = await supabaseAdmin
      .from("drops")
      .insert(dropPayload)
      .select()
      .single();

    if (dropError) {
      console.error("Drop creation error:", dropError);
      return NextResponse.json(
        { error: 'Failed to create drop', details: dropError.message },
        { status: 500 }
      );
    }

    if (!dropData) {
      return NextResponse.json(
        { error: 'Failed to create drop - no data returned' },
        { status: 500 }
      );
    }

    console.log("✅ Drop created successfully:", dropData.id);

    // Insert recipients if provided
    if (recipientEmails.length > 0) {
      const recipientData = recipientEmails.map((email: string) => ({
        drop_id: dropData.id,
        email: email,
        time_limit_hours: timerMode === 'verification' ? defaultTimeLimitHours : null
      }));

      const { error: recipientError } = await supabaseAdmin
        .from('drop_recipients')
        .insert(recipientData);

      if (recipientError) {
        console.error('Error inserting recipients:', recipientError);
        // Don't fail the entire operation, just log the error
      } else {
        console.log(`✅ ${recipientEmails.length} recipients added`);
      }
    }

    // ===== UPDATE USAGE TRACKING =====
    try {
      console.log('📊 Updating usage tracking...');
      await updateUsageAfterDrop(userId, recipientCount, fileSizeMb);
      console.log('✅ Usage tracking updated');
    } catch (usageError) {
      console.error('❌ Error updating usage tracking:', usageError);
      // Don't fail the operation for usage tracking errors
    }

    // Return success response
    return NextResponse.json({
      success: true,
      drop: dropData,
      message: 'Drop created successfully',
      recipients_added: recipientEmails.length,
      usage_updated: true
    });

  } catch (error: any) {
    console.error('❌ Drop creation API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}