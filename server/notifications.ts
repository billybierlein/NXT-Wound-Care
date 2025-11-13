import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export interface NewSalesRepNotificationData {
  salesRepName: string;
  salesRepEmail: string;
  registrationDate: Date;
}

/**
 * Send notification to admin when a new sales rep registers
 */
export async function sendNewSalesRepNotification(
  data: NewSalesRepNotificationData,
  adminEmail: string = process.env.ADMIN_EMAIL || "billy@nxtmedical.us" // Updated main admin email
): Promise<boolean> {
  try {
    const emailContent = {
      to: adminEmail,
      from: {
        email: "info@nxtmedical.us", // Verified sender email
        name: "NXT Medical Wound Care System"
      },
      subject: `New Sales Rep Registration: ${data.salesRepName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0 0 10px 0;">New Sales Rep Registration</h2>
            <p style="color: #6b7280; margin: 0;">A new sales representative has registered through your invitation system.</p>
          </div>
          
          <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #1f2937; margin: 0 0 15px 0;">Sales Rep Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 40%;">Name:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.salesRepName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.salesRepEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Registration Date:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.registrationDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h4 style="color: #92400e; margin: 0 0 10px 0;">Action Required</h4>
            <p style="color: #92400e; margin: 0;">Please log into the system to assign a commission rate for this new sales representative.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://app.nxtmedical.us/manage-sales-reps" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Manage Sales Reps
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p>This is an automated notification from the NXT Medical Wound Care Patient Management System.</p>
          </div>
        </div>
      `,
      text: `
New Sales Rep Registration

A new sales representative has registered through your invitation system.

Sales Rep Details:
- Name: ${data.salesRepName}
- Email: ${data.salesRepEmail}
- Registration Date: ${data.registrationDate.toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

Action Required:
Please log into the system to assign a commission rate for this new sales representative.

Manage Sales Reps: https://app.nxtmedical.us/manage-sales-reps

This is an automated notification from the NXT Medical Wound Care Patient Management System.
      `
    };

    console.log(`Sending new sales rep notification for: ${data.salesRepName} (${data.salesRepEmail})`);
    await mailService.send(emailContent);
    console.log("New sales rep notification sent successfully!");
    
    return true;
  } catch (error) {
    console.error('Failed to send new sales rep notification:', error);
    return false;
  }
}

/**
 * Send welcome email to the newly registered sales rep
 */
export async function sendWelcomeEmailToSalesRep(
  salesRepName: string,
  salesRepEmail: string
): Promise<boolean> {
  try {
    const emailContent = {
      to: salesRepEmail,
      from: {
        email: "info@nxtmedical.us", // Verified sender email
        name: "NXT Medical Wound Care System"
      },
      subject: "Welcome to NXT Medical Wound Care System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0;">Welcome to NXT Medical!</h1>
          </div>
          
          <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Hi ${salesRepName.split(' ')[0]},</h2>
            
            <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
              Welcome to the NXT Medical Wound Care Patient Management System! Your account has been successfully created and you now have access to our comprehensive platform.
            </p>
            
            <h3 style="color: #2563eb; margin: 20px 0 15px 0;">What you can do:</h3>
            <ul style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
              <li>Manage patient records and treatment plans</li>
              <li>Track referral sources and provider relationships</li>
              <li>View sales reports and commission information</li>
              <li>Access the AI assistant for medical insights</li>
              <li>Generate and export reports</li>
            </ul>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="color: #374151; margin: 0; font-weight: bold;">
                📧 Your login email: ${salesRepEmail}
              </p>
            </div>
            
            <p style="color: #374151; line-height: 1.6; margin-bottom: 30px;">
              If you have any questions or need assistance getting started, please don't hesitate to reach out to your administrator.
            </p>
            
            <div style="text-align: center;">
              <a href="https://app.nxtmedical.us" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Access Your Dashboard
              </a>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>Thank you for joining the NXT Medical team!</p>
          </div>
        </div>
      `,
      text: `
Welcome to NXT Medical Wound Care System!

Hi ${salesRepName.split(' ')[0]},

Welcome to the NXT Medical Wound Care Patient Management System! Your account has been successfully created and you now have access to our comprehensive platform.

What you can do:
- Manage patient records and treatment plans
- Track referral sources and provider relationships
- View sales reports and commission information
- Access the AI assistant for medical insights
- Generate and export reports

Your login email: ${salesRepEmail}

If you have any questions or need assistance getting started, please don't hesitate to reach out to your administrator.

Access Your Dashboard: https://app.nxtmedical.us

Thank you for joining the NXT Medical team!
      `
    };

    console.log(`Sending welcome email to: ${salesRepName} (${salesRepEmail})`);
    await mailService.send(emailContent);
    console.log("Welcome email sent successfully!");
    
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}

/**
 * Send notification when a new patient referral is uploaded
 */
export interface NewReferralNotificationData {
  uploadedByName: string;
  uploadedByEmail: string;
  fileName: string;
  uploadDate: Date;
  referralId: number;
}

export async function sendNewReferralNotification(
  data: NewReferralNotificationData
): Promise<boolean> {
  try {
    const recipients = ["info@nxtmedical.us", "ernest@nxtmedical.us"];
    const referralUrl = `https://app.nxtmedical.us/patient-referrals`;
    
    const emailContent = {
      to: recipients,
      from: {
        email: "info@nxtmedical.us",
        name: "NXT Medical Wound Care System"
      },
      subject: `New Patient Referral Uploaded by ${data.uploadedByName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0;">📄 New Patient Referral</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">A new referral has been uploaded and needs review</p>
          </div>
          
          <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 30px;">
            <h3 style="color: #1f2937; margin: 0 0 20px 0;">Referral Details</h3>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 40%;">Uploaded By:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.uploadedByName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.uploadedByEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">File Name:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.fileName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Upload Date:</td>
                <td style="padding: 8px 0; color: #6b7280;">${data.uploadDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</td>
              </tr>
            </table>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #92400e; margin: 0 0 10px 0;">⚡ Action Required</h4>
              <p style="color: #92400e; margin: 0;">This referral is in the "New / Needs Review" column and requires your attention.</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${referralUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Review Referral
              </a>
            </div>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p>This is an automated notification from the NXT Medical Wound Care Patient Management System.</p>
          </div>
        </div>
      `,
      text: `
New Patient Referral Uploaded

A new referral has been uploaded and needs review.

Referral Details:
- Uploaded By: ${data.uploadedByName}
- Email: ${data.uploadedByEmail}
- File Name: ${data.fileName}
- Upload Date: ${data.uploadDate.toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

Action Required:
This referral is in the "New / Needs Review" column and requires your attention.

Review Referral: ${referralUrl}

This is an automated notification from the NXT Medical Wound Care Patient Management System.
      `
    };

    console.log(`Sending new referral notification for file: ${data.fileName}`);
    await mailService.send(emailContent);
    console.log("New referral notification sent successfully to info@ and ernest@!");
    
    return true;
  } catch (error) {
    console.error('Failed to send new referral notification:', error);
    return false;
  }
}

/**
 * Send invitation email to the invited user with registration link
 */
export async function sendInvitationEmail(
  inviteeEmail: string,
  inviteeName: string,
  registrationToken: string,
  commissionRate: string,
  inviterName?: string
): Promise<boolean> {
  try {
    // Force hardcoded domain - ignore all environment variables
    const CUSTOM_DOMAIN = "app.nxtmedical.us";
    const registrationUrl = `https://${CUSTOM_DOMAIN}/register/${registrationToken}`;
    
    // Custom domain configuration for production deployment
    
    const emailContent = {
      to: inviteeEmail,
      from: {
        email: "info@nxtmedical.us", // Verified sender email
        name: "NXT Medical Wound Care System"
      },
      subject: "You're Invited to Join NXT Medical Wound Care System",
      mailSettings: {
        sandboxMode: {
          enable: false
        }
      },
      trackingSettings: {
        clickTracking: {
          enable: false, // Disable click tracking to prevent URL rewriting
          enableText: false
        },
        openTracking: {
          enable: false // Disable open tracking too
        },
        ganalytics: {
          enable: false
        },
        subscriptionTracking: {
          enable: false
        }
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0;">Welcome to NXT Medical!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been invited to join our wound care management platform</p>
          </div>
          
          <div style="background-color: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Hi there!</h2>
            
            <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
              ${inviterName ? `${inviterName} has` : 'You have been'} invited you to join the NXT Medical Wound Care Patient Management System as a Sales Representative.
            </p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin: 0 0 15px 0;">Your Account Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 40%;">Email:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${inviteeEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Role:</td>
                  <td style="padding: 8px 0; color: #6b7280;">Sales Representative</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Commission Rate:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${commissionRate}%</td>
                </tr>
              </table>
            </div>
            
            <h3 style="color: #1f2937; margin: 20px 0 15px 0;">What you'll have access to:</h3>
            <ul style="color: #374151; line-height: 1.6; margin-bottom: 25px; padding-left: 20px;">
              <li>Comprehensive patient management system</li>
              <li>Treatment tracking and reporting tools</li>
              <li>Provider and referral source management</li>
              <li>Commission tracking and sales reports</li>
              <li>AI-powered medical assistant</li>
              <li>Mobile-friendly interface for field work</li>
            </ul>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-weight: bold;">⏰ Complete your registration to get started!</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${registrationUrl}" 
                 style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;"
                 target="_blank" rel="noopener noreferrer" data-saferedirecturl="${registrationUrl}">
                Complete Registration
              </a>
            </div>
            
            <div style="text-align: center; margin: 15px 0; font-size: 14px; color: #6b7280;">
              <p>Or copy this link directly:</p>
              <p style="word-break: break-all; font-family: monospace; background-color: #f3f4f6; padding: 10px; border-radius: 4px;"><strong>${registrationUrl}</strong></p>
            </div>
            
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin-top: 25px;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                <strong>Security Note:</strong> This invitation link is unique to you and will expire in 14 days. 
                If you didn't expect this invitation, please contact your administrator.
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>This invitation was sent by the NXT Medical Wound Care System.</p>
            <p>If you have any questions, please contact your administrator.</p>
          </div>
        </div>
      `,
      text: `
You're Invited to Join NXT Medical Wound Care System

Hi there!

${inviterName ? `${inviterName} has` : 'You have been'} invited you to join the NXT Medical Wound Care Patient Management System as a Sales Representative.

Your Account Details:
- Email: ${inviteeEmail}
- Role: Sales Representative  
- Commission Rate: ${commissionRate}%

What you'll have access to:
- Comprehensive patient management system
- Treatment tracking and reporting tools
- Provider and referral source management
- Commission tracking and sales reports
- AI-powered medical assistant
- Mobile-friendly interface for field work

Complete your registration: ${registrationUrl}

Security Note: This invitation link is unique to you and will expire in 14 days. If you didn't expect this invitation, please contact your administrator.

This invitation was sent by the NXT Medical Wound Care System.
If you have any questions, please contact your administrator.
      `
    };

    console.log(`Sending invitation email to: ${inviteeEmail}`);
    await mailService.send(emailContent);
    console.log("Invitation email sent successfully!");
    
    return true;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return false;
  }
}