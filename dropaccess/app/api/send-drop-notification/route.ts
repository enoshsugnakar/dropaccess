import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { DropNotificationEmail } from '@/components/emails/DropNotificationEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      dropId, 
      recipientEmails, 
      dropData, 
      creatorEmail 
    } = body;

    // Validate required fields
    if (!dropId || !recipientEmails || !dropData || !creatorEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return NextResponse.json(
        { error: 'Recipients must be a non-empty array' },
        { status: 400 }
      );
    }

    // Generate access link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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

    // Send emails to all recipients
    const emailPromises = recipientEmails.map(async (email: string) => {
      try {
        const { data, error } = await resend.emails.send({
          from: 'DropAccess <noreply@app.dropaccess.net>', // Update with your verified domain
          to: [email.trim()],
          subject: `You've received a secure drop: ${dropData.name}`,
          react: DropNotificationEmail({
            dropName: dropData.name,
            dropDescription: dropData.description,
            creatorEmail: creatorEmail,
            accessLink: accessLink,
            timerMode: timerMode,
            expiryInfo: expiryInfo
          }),
        });

        if (error) {
          console.error(`Failed to send email to ${email}:`, error);
          return { email, success: false, error: error.message };
        }

        return { email, success: true, messageId: data?.id };
      } catch (err) {
        console.error(`Error sending email to ${email}:`, err);
        return { email, success: false, error: 'Unknown error occurred' };
      }
    });

    // Wait for all emails to complete
    const results = await Promise.all(emailPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}