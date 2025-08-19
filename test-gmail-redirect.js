import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Test different email formats to see which one Gmail doesn't redirect
const testToken = "c6473b695b0ea5dd9ad69b82da0343f7e5b42842542de1b9a129b4b58ea1056a";
const testUrl = `https://app.nxtmedical.us/register/${testToken}`;

const msg = {
  to: 'bierleinbilly@gmail.com',
  from: 'info@nxtmedical.us',
  subject: '🔧 Gmail Redirect Test - Multiple Link Formats',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Gmail Redirect Test</h2>
      <p>Testing different link formats to avoid Gmail redirection:</p>
      
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3>Format 1: Standard HTML Link</h3>
        <a href="${testUrl}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8;">
          ${testUrl}
        </a>
      </div>
      
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3>Format 2: Link with data-saferedirecturl</h3>
        <a href="${testUrl}" target="_blank" rel="noopener noreferrer" data-saferedirecturl="${testUrl}" style="color: #1a73e8;">
          ${testUrl}
        </a>
      </div>
      
      <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <h3>Format 3: Plain Text URL</h3>
        <p>Copy this URL directly: <code>${testUrl}</code></p>
      </div>
      
      <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
        <p><strong>Instructions:</strong></p>
        <ol>
          <li>Try clicking each link format above</li>
          <li>See which one goes directly to app.nxtmedical.us</li>
          <li>Reply with which format works correctly</li>
        </ol>
      </div>
    </div>
  `,
  text: `Gmail Redirect Test
  
Format 1 URL: ${testUrl}
Format 2 URL: ${testUrl} 
Format 3 URL: ${testUrl}

Try each format to see which works correctly.`,
  mailSettings: {
    sandboxMode: {
      enable: false
    }
  },
  trackingSettings: {
    clickTracking: {
      enable: false,
      enableText: false
    },
    openTracking: {
      enable: false
    },
    ganalytics: {
      enable: false
    },
    subscriptionTracking: {
      enable: false
    }
  }
};

console.log("Sending Gmail redirect test...");
sgMail.send(msg)
  .then(() => {
    console.log('Gmail redirect test sent successfully');
  })
  .catch((error) => {
    console.error('Error:', error);
  });