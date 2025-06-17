import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { DropNotificationEmail } from '@/components/emails/DropNotificationEmail';
import { getPostHogClient, captureEvent } from '@/lib/posthog';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const emailStartTime = Date.now();
  let dropId = 'unknown';
  let recipientCount = 0;
  let creatorEmail = 'unknown';
  
  try {
    const body = await request.json();
    const { 
      dropId: requestDropId, 
      recipientEmails, 
      dropData, 
      creatorEmail: requestCreatorEmail,
      creatorDisplayName 
    } = body;

    // Store for tracking
    dropId = requestDropId;
    recipientCount = recipientEmails ? recipientEmails.length : 0;
    creatorEmail = requestCreatorEmail;

    // Validate required fields
    if (!dropId || !recipientEmails || !dropData || !creatorEmail) {
      // Track validation failure
      await captureEvent(creatorEmail, 'email_api_validation_failed', {
        drop_id: dropId,
        missing_fields: [
          !dropId && 'dropId',
          !recipientEmails && 'recipientEmails', 
          !dropData && 'dropData',
          !creatorEmail && 'creatorEmail'
        ].filter(Boolean),
        api_duration_ms: Date.now() - emailStartTime
      });

      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      // Track invalid recipients
      await captureEvent(creatorEmail, 'email_api_invalid_recipients', {
        drop_id: dropId,
        recipients_type: typeof recipientEmails,
        recipients_length: Array.isArray(recipientEmails) ? recipientEmails.length : 0,
        api_duration_ms: Date.now() - emailStartTime
      });

      return NextResponse.json(
        { error: 'Recipients must be a non-empty array' },
        { status: 400 }
      );
    }

    // Generate access link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dropaccess.net';
    const accessLink = `${baseUrl}/drops/${dropId}`;

    // Determine timer mode and format expiry info
    const timerMode = dropData.expires_at ? 'creation' : 'verification';
    let expiryInfo = '';

    if (timerMode === 'creation' && dropData.expires_at) {
      // Format the expiry date
      const expiryDate = new Date(dropData.expires_at);
      expiryInfo = expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } else if (timerMode === 'verification' && dropData.default_time_limit_hours) {
      // Format the time limit
      const hours = dropData.default_time_limit_hours;
      if (hours < 24) {
        expiryInfo = `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        if (remainingHours === 0) {
          expiryInfo = `${days} day${days !== 1 ? 's' : ''}`;
        } else {
          expiryInfo = `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
        }
      }
    }

    // Track email sending initiation
    await captureEvent(creatorEmail, 'email_sending_started', {
      drop_id: dropId,
      recipient_count: recipientEmails.length,
      timer_mode: timerMode,
      drop_type: dropData.drop_type,
      has_description: !!dropData.description,
      recipient_domains: [...new Set(recipientEmails.map((email: string) => email.split('@')[1]))].length
    });

    // Send emails to all recipients
    const emailPromises = recipientEmails.map(async (email: string, index: number) => {
      const emailSendStartTime = Date.now();
      
      try {
        const { data, error } = await resend.emails.send({
          from: 'DropAccess <noreply@app.dropaccess.net>', // Update with your verified domain
          to: [email.trim()],
          subject: `🔐 ${dropData.name} - Secure drop from ${body.creatorDisplayName || body.creatorEmail.split('@')[0]}`,
          react: DropNotificationEmail({
            dropName: dropData.name,
            dropDescription: dropData.description,
            creatorEmail: creatorEmail,
            creatorDisplayName: body.creatorDisplayName, // Add this line
            accessLink: accessLink,
            timerMode: timerMode,
            expiryInfo: expiryInfo
          }),
        }); 

        const emailSendDuration = Date.now() - emailSendStartTime;

        if (error) {
          console.error(`Failed to send email to ${email}:`, error);
          
          // Track individual email failure
          await captureEvent(creatorEmail, 'email_send_failed', {
            drop_id: dropId,
            recipient_email: email,
            recipient_domain: email.split('@')[1],
            recipient_index: index,
            error_message: error.message,
            error_type: error.name || 'unknown',
            send_duration_ms: emailSendDuration,
            total_recipients: recipientEmails.length
          });

          return { email, success: false, error: error.message };
        }

        // Track individual email success
        await captureEvent(creatorEmail, 'email_send_success', {
          drop_id: dropId,
          recipient_email: email,
          recipient_domain: email.split('@')[1],
          recipient_index: index,
          message_id: data?.id,
          send_duration_ms: emailSendDuration,
          total_recipients: recipientEmails.length
        });

        return { email, success: true, messageId: data?.id };
      } catch (err) {
        const emailSendDuration = Date.now() - emailSendStartTime;
        console.error(`Error sending email to ${email}:`, err);
        
        // Track unexpected email error
        await captureEvent(creatorEmail, 'email_send_error', {
          drop_id: dropId,
          recipient_email: email,
          recipient_domain: email.split('@')[1],
          recipient_index: index,
          error_type: 'network_error',
          error_message: (err as Error).message || 'Unknown error',
          send_duration_ms: emailSendDuration,
          total_recipients: recipientEmails.length
        });

        return { email, success: false, error: 'Unknown error occurred' };
      }
    });

    // Wait for all emails to complete
    const results = await Promise.all(emailPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalDuration = Date.now() - emailStartTime;

    // Calculate email metrics
    const successRate = Math.round((successful.length / results.length) * 100);
    const domains = [...new Set(recipientEmails.map((email: string) => email.split('@')[1]))];
    const averageSendTime = totalDuration / results.length;

    // Track overall email batch completion
    await captureEvent(creatorEmail, 'email_batch_completed', {
      drop_id: dropId,
      total_recipients: results.length,
      successful_emails: successful.length,
      failed_emails: failed.length,
      success_rate_percent: successRate,
      total_duration_ms: totalDuration,
      average_send_time_ms: averageSendTime,
      unique_domains: domains.length,
      timer_mode: timerMode,
      drop_type: dropData.drop_type,
      // Domain-specific metrics
      gmail_recipients: recipientEmails.filter((email: string) => email.includes('@gmail.com')).length,
      outlook_recipients: recipientEmails.filter((email: string) => 
        email.includes('@outlook.com') || email.includes('@hotmail.com')
      ).length,
      custom_domain_recipients: recipientEmails.filter((email: string) => 
        !email.includes('@gmail.com') && 
        !email.includes('@outlook.com') && 
        !email.includes('@hotmail.com') &&
        !email.includes('@yahoo.com')
      ).length
    });

    // Track failures by domain if any
    if (failed.length > 0) {
      const failuresByDomain = failed.reduce((acc: Record<string, number>, result) => {
        const domain = result.email.split('@')[1];
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      }, {});

      await captureEvent(creatorEmail, 'email_failures_by_domain', {
        drop_id: dropId,
        failures_by_domain: failuresByDomain,
        total_failures: failed.length,
        most_failed_domain: Object.entries(failuresByDomain).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0]
      });
    }

    // Log results
    console.log(`Email sending results for drop ${dropId}:`);
    console.log(`Successful: ${successful.length}/${results.length}`);
    if (failed.length > 0) {
      console.log('Failed emails:', failed);
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${successful.length}/${results.length} emails successfully`,
      results: {
        successful: successful.length,
        failed: failed.length,
        details: results
      }
    });

  } catch (error) {
    console.error('Error in send-drop-notification API:', error);
    
    // Track API error
    try {
      await captureEvent(creatorEmail, 'email_api_error', {
        drop_id: dropId,
        recipient_count: recipientCount,
        error_message: (error as Error).message || 'Unknown error',
        error_type: 'api_error',
        api_duration_ms: Date.now() - emailStartTime
      });
    } catch (trackingError) {
      console.error('Failed to track email API error:', trackingError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}