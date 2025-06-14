import React from 'react';

interface DropNotificationEmailProps {
  dropName: string;
  dropDescription?: string;
  creatorEmail: string;
  creatorDisplayName?: string;
  accessLink: string;
  timerMode: 'creation' | 'verification';
  expiryInfo: string;
}

export const DropNotificationEmail: React.FC<DropNotificationEmailProps> = ({
  dropName,
  dropDescription,
  creatorEmail,
  creatorDisplayName,
  accessLink,
  timerMode,
  expiryInfo
}) => {
  const displayName = creatorDisplayName || creatorEmail.split('@')[0] || 'A colleague';
  
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      lineHeight: '1.6',
      color: '#1f2937',
      backgroundColor: '#ffffff',
      margin: '0',
      padding: '15px'
    }}>
      {/* Email Container */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          backgroundColor: '#00c951',
          padding: '32px 40px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            margin: '0',
            color: '#ffffff',
            letterSpacing: '-0.025em'
          }}>
            Secure Content Access Request
          </h1>
          <p style={{
            fontSize: '16px',
            margin: '8px 0 0 0',
            color: '#ffffff',
            fontWeight: '400'
          }}>
            You have been granted access to secure content
          </p>
        </div>

        {/* Main Content */}
        <div style={{ padding: '40px' }}>
          
          {/* Professional Greeting */}
          <p style={{
            fontSize: '16px',
            marginBottom: '24px',
            color: '#374151',
            lineHeight: '1.5'
          }}>
            Dear Recipient,
          </p>

          <p style={{
            fontSize: '16px',
            marginBottom: '32px',
            color: '#374151',
            lineHeight: '1.5'
          }}>
            <strong>{displayName}</strong> ({creatorEmail}) has shared secure content with you through DropAccess. 
            This message contains access credentials for time-sensitive material that requires email verification.
          </p>

          {/* Content Details */}
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '24px',
            marginBottom: '32px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 16px 0',
              color: '#1f2937'
            }}>
              Content Details
            </h2>
            
            <div style={{ marginBottom: '12px' }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#6b7280',
                display: 'inline-block',
                width: '100px'
              }}>
                Title:
              </span>
              <span style={{
                fontSize: '14px',
                color: '#1f2937',
                fontWeight: '500'
              }}>
                {dropName}
              </span>
            </div>

            {dropDescription && (
              <div style={{ marginBottom: '12px' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#6b7280',
                  display: 'inline-block',
                  width: '100px'
                }}>
                  Description:
                </span>
                <span style={{
                  fontSize: '14px',
                  color: '#1f2937'
                }}>
                  {dropDescription}
                </span>
              </div>
            )}

            <div>
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#6b7280',
                display: 'inline-block',
                width: '100px'
              }}>
                Shared by:
              </span>
              <span style={{
                fontSize: '14px',
                color: '#1f2937'
              }}>
                {displayName} ({creatorEmail})
              </span>
            </div>
          </div>

          {/* Access Information */}
          <div style={{
            backgroundColor: timerMode === 'creation' ? '#fef3c7' : '#dbeafe',
            border: `1px solid ${timerMode === 'creation' ? '#d97706' : '#00c951'}`,
            borderRadius: '6px',
            padding: '20px',
            marginBottom: '32px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 12px 0',
              color: timerMode === 'creation' ? '#92400e' : '#1e40af'
            }}>
              Access Timeline
            </h3>
            
            <p style={{
              margin: '0',
              fontSize: '14px',
              color: timerMode === 'creation' ? '#92400e' : '#1e40af',
              lineHeight: '1.5'
            }}>
              {timerMode === 'creation' 
                ? `This content expires on ${expiryInfo}. Please access before the deadline.`
                : `You have ${expiryInfo} to access this content after completing email verification.`
              }
            </p>
          </div>

          {/* Access Instructions */}
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '20px',
            marginBottom: '32px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 16px 0',
              color: '#0369a1'
            }}>
              Access Instructions
            </h3>
            
            <ol style={{
              margin: '0',
              paddingLeft: '20px',
              color: '#0369a1',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              <li style={{ marginBottom: '8px' }}>
                Click the "Access Content" button below
              </li>
              <li style={{ marginBottom: '8px' }}>
                Verify your email address when prompted
              </li>
              <li style={{ marginBottom: '8px' }}>
                View or download the secure content
              </li>
              <li>
                Contact the sender if you experience any issues
              </li>
            </ol>
          </div>

          {/* Access Button */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <a 
              href={accessLink}
              style={{
                display: 'inline-block',
                backgroundColor: '#00c951',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '14px 32px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.025em'
              }}
            >
              Access Content
            </a>
          </div>

          {/* Security Notice */}
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              margin: '0 0 8px 0',
              color: '#dc2626'
            }}>
              Security Notice
            </h4>
            <p style={{
              margin: '0',
              fontSize: '13px',
              color: '#dc2626',
              lineHeight: '1.4'
            }}>
              This access link is personalized for your email address only. 
              Do not forward this email or share the access link with others. 
              The link contains unique security credentials tied to your email.
            </p>
          </div>

          {/* Support Information */}
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.5',
            marginBottom: '0'
          }}>
            If you have questions about this content or need assistance accessing it, 
            please contact <a href={`mailto:${creatorEmail}`} style={{ color: '#00c951', textDecoration: 'none' }}>{displayName}</a> directly.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '24px 40px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 8px 0',
            lineHeight: '1.4'
          }}>
            This message was sent through DropAccess, a secure content sharing platform.
          </p>
          
          <div style={{
            fontSize: '11px',
            color: '#9ca3af',
            fontWeight: '500'
          }}>
            <span style={{ color: '#00c951', fontWeight: '600' }}>DropAccess</span>
            {' • '}
            Privacy-first content sharing
          </div>
        </div>
      </div>
    </div>
  );
};