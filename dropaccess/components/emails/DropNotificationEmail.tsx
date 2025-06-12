import React from 'react';

interface DropNotificationEmailProps {
  dropName: string;
  dropDescription?: string;
  creatorEmail: string;
  accessLink: string;
  timerMode: 'creation' | 'verification';
  expiryInfo: string; // Pre-formatted expiry text
}

export const DropNotificationEmail: React.FC<DropNotificationEmailProps> = ({
  dropName,
  dropDescription,
  creatorEmail,
  accessLink,
  timerMode,
  expiryInfo
}) => {
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#ffffff',
      color: '#333333'
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '20px',
        marginBottom: '30px'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          margin: '0 0 10px 0',
          color: '#1f2937'
        }}>
          You've received a secure drop
        </h1>
        <p style={{
          fontSize: '16px',
          margin: '0',
          color: '#6b7280'
        }}>
          Hello,
        </p>
      </div>

      {/* Creator Info */}
      <p style={{
        fontSize: '16px',
        margin: '0 0 25px 0',
        lineHeight: '1.5'
      }}>
        <strong>{creatorEmail}</strong> has shared a secure drop with you.
      </p>

      {/* Drop Details */}
      <div style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '25px'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          margin: '0 0 15px 0',
          color: '#1f2937'
        }}>
          Drop Details:
        </h2>
        <ul style={{
          margin: '0',
          paddingLeft: '20px',
          lineHeight: '1.6'
        }}>
          <li style={{ marginBottom: '8px' }}>
            <strong>Name:</strong> {dropName}
          </li>
          <li>
            <strong>Description:</strong> {dropDescription || "No description provided"}
          </li>
        </ul>
      </div>

      {/* Access Information */}
      <div style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '25px'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          margin: '0 0 15px 0',
          color: '#92400e'
        }}>
          Access Information:
        </h2>
        <p style={{
          margin: '0',
          fontSize: '16px',
          lineHeight: '1.5',
          color: '#92400e'
        }}>
          {timerMode === 'creation' 
            ? `This drop expires on ${expiryInfo}. Access this drop before expiry.`
            : `You have ${expiryInfo} to access this drop after verifying your email. Your timer starts once you verify your email.`
          }
        </p>
      </div>

      {/* Access Instructions */}
      <div style={{
        marginBottom: '30px'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          margin: '0 0 15px 0',
          color: '#1f2937'
        }}>
          To access your drop:
        </h2>
        <ol style={{
          margin: '0',
          paddingLeft: '20px',
          lineHeight: '1.6'
        }}>
          <li style={{ marginBottom: '5px' }}>Click the link below</li>
          <li style={{ marginBottom: '5px' }}>Verify your email address</li>
          <li>Access the secure content</li>
        </ol>
      </div>

      {/* Access Button */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <a 
          href={accessLink}
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            padding: '15px 30px',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Access Your Drop
        </a>
      </div>

      {/* Security Note */}
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fca5a5',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '30px'
      }}>
        <p style={{
          margin: '0',
          fontSize: '14px',
          color: '#dc2626',
          fontWeight: '500'
        }}>
          <strong>Note:</strong> This link is only valid for your email address. Do not share this link with others.
        </p>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        paddingTop: '20px',
        textAlign: 'center'
      }}>
        <p style={{
          margin: '0',
          fontSize: '14px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Secured by DropAccess - Privacy-first content sharing
        </p>
      </div>
    </div>
  );
};