// OrBit Security - Centralized Resend Email Dispatcher
const DEFAULT_SENDER = 'OrBit Security <sales@orbit-sync.dev>';

export const sendVerificationEmail = async (targetEmail: string, verificationCode: string) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;

  const subject = `Your OrBit Security Code: ${verificationCode}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OrBit Verification Code</title>
    </head>
    <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color:#0a0808; border: 1px solid rgba(255, 0, 60, 0.35); border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px rgba(255, 0, 60, 0.15);">
              <tr>
                <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                    ORBIT<span style="color: #ff003c;">.SYNC</span>
                  </div>
                  <div style="color: #808085; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px;">
                    Local-First Synchronization Engine
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 35px;">
                  <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                    Email Verification Handshake
                  </h2>
                  <p style="margin: 0 0 25px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    You are authenticating developer credentials for <strong style="color: #ffffff;">${targetEmail}</strong>. Use the security code below to complete registration:
                  </p>
                  
                  <div style="background: #120d0e; border: 1.5px solid #ff003c; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 25px;">
                    <div style="font-family: monospace, Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ff003c; text-shadow: 0 0 15px rgba(255, 0, 60, 0.5);">
                      ${verificationCode}
                    </div>
                  </div>

                  <p style="margin: 0 0 10px 0; color: #808085; font-size: 12px; line-height: 1.5; text-align: center;">
                    ⏳ This code is valid for <strong style="color: #ff003c;">10 minutes</strong>.
                  </p>
                  <p style="margin: 0; color: #606065; font-size: 11px; text-align: center;">
                    If you did not request this code, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                  <p style="margin: 0; color: #505055; font-size: 11px;">
                    OrBit Mesh Protocol &bull; Zero-Knowledge P2P Infrastructure
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (resendApiKey) {
    try {
      console.log(`[Resend Mailer] Dispatching OTP email via HTTPS REST API to ${targetEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Verification email successfully sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      } else {
        console.error('[Resend Mailer Error] API returned error:', resData);
        return { success: false, error: resData };
      }
    } catch (err) {
      console.error('[Resend Mailer Error] HTTPS fetch failed:', err);
      return { success: false, error: err };
    }
  } else {
    console.log(`=========================================`);
    console.log(`[Fallback Log] EMAIL VERIFICATION CODE`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Verification Code: ${verificationCode}`);
    console.log(`=========================================`);
    return { success: true, fallback: true };
  }
};

export const sendPasswordChangeOtpEmail = async (targetEmail: string, verificationCode: string) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;

  const subject = `Security Alert: OrBit Password Change Code: ${verificationCode}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OrBit Password Change OTP</title>
    </head>
    <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color:#0a0808; border: 1px solid rgba(255, 0, 60, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px rgba(255, 0, 60, 0.2);">
              <tr>
                <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                    ORBIT<span style="color: #ff003c;">.SECURITY</span>
                  </div>
                  <div style="color: #ff4c75; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; font-weight: bold;">
                    ⚠️ Password Change Request
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 35px;">
                  <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                    Confirm Password Update
                  </h2>
                  <p style="margin: 0 0 20px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    A request was initiated to update the login password for developer account <strong style="color: #ffffff;">${targetEmail}</strong>.
                  </p>
                  <p style="margin: 0 0 25px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    To authorize this change, enter the cryptographic 6-digit confirmation code:
                  </p>
                  
                  <div style="background: #120d0e; border: 1.5px solid #ff003c; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 25px;">
                    <div style="font-family: monospace, Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ff003c; text-shadow: 0 0 15px rgba(255, 0, 60, 0.5);">
                      ${verificationCode}
                    </div>
                  </div>

                  <p style="margin: 0 0 10px 0; color: #808085; font-size: 12px; line-height: 1.5; text-align: center;">
                    ⏳ This code is valid for <strong style="color: #ff003c;">10 minutes</strong>.
                  </p>
                  <div style="background: rgba(255, 76, 117, 0.08); border: 1px solid rgba(255, 76, 117, 0.2); border-radius: 8px; padding: 12px; margin-top: 20px;">
                    <p style="margin: 0; color: #ff4c75; font-size: 12px; line-height: 1.4; text-align: center;">
                      <strong>Important:</strong> If you did NOT request a password change, please contact support immediately.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                  <p style="margin: 0; color: #505055; font-size: 11px;">
                    OrBit Mesh Protocol &bull; Zero-Knowledge P2P Infrastructure
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (resendApiKey) {
    try {
      console.log(`[Resend Mailer] Dispatching Password Change OTP to ${targetEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Password Change OTP successfully sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      } else {
        console.error('[Resend Mailer Error] API error on password OTP:', resData);
        return { success: false, error: resData };
      }
    } catch (err) {
      console.error('[Resend Mailer Error] Failed password OTP dispatch:', err);
      return { success: false, error: err };
    }
  } else {
    console.log(`=========================================`);
    console.log(`[Fallback Log] PASSWORD CHANGE OTP CODE`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Verification Code: ${verificationCode}`);
    console.log(`=========================================`);
    return { success: true, fallback: true };
  }
};

export const sendTwoFactorOtpEmail = async (targetEmail: string, verificationCode: string) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;

  const subject = `Your 2FA Login Security Code: ${verificationCode}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OrBit Two-Factor Authentication</title>
    </head>
    <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color:#0a0808; border: 1px solid rgba(255, 0, 60, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px rgba(255, 0, 60, 0.2);">
              <tr>
                <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                    ORBIT<span style="color: #ff003c;">.2FA</span>
                  </div>
                  <div style="color: #00e676; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; font-weight: bold;">
                    🔒 Two-Factor Sign-In Challenge
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 35px;">
                  <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                    Two-Factor Login Verification
                  </h2>
                  <p style="margin: 0 0 20px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    A sign-in request was made for developer account <strong style="color: #ffffff;">${targetEmail}</strong>.
                  </p>
                  <p style="margin: 0 0 25px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    Enter your 2-step security verification code to complete authentication:
                  </p>
                  
                  <div style="background: #120d0e; border: 1.5px solid #ff003c; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 25px;">
                    <div style="font-family: monospace, Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ff003c; text-shadow: 0 0 15px rgba(255, 0, 60, 0.5);">
                      ${verificationCode}
                    </div>
                  </div>

                  <p style="margin: 0 0 10px 0; color: #808085; font-size: 12px; line-height: 1.5; text-align: center;">
                    ⏳ This code is valid for <strong style="color: #ff003c;">10 minutes</strong>.
                  </p>
                  <p style="margin: 0; color: #606065; font-size: 11px; text-align: center;">
                    If you did not attempt to sign in, someone may know your password. Change your password immediately.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                  <p style="margin: 0; color: #505055; font-size: 11px;">
                    OrBit Mesh Protocol &bull; Zero-Knowledge P2P Infrastructure
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (resendApiKey) {
    try {
      console.log(`[Resend Mailer] Dispatching 2FA Login OTP to ${targetEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] 2FA Login OTP successfully sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      } else {
        console.error('[Resend Mailer Error] API error on 2FA OTP:', resData);
        return { success: false, error: resData };
      }
    } catch (err) {
      console.error('[Resend Mailer Error] Failed 2FA OTP dispatch:', err);
      return { success: false, error: err };
    }
  } else {
    console.log(`=========================================`);
    console.log(`[Fallback Log] 2FA LOGIN OTP CODE`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Verification Code: ${verificationCode}`);
    console.log(`=========================================`);
    return { success: true, fallback: true };
  }
};

export const sendForgotPasswordOtpEmail = async (targetEmail: string, verificationCode: string) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;

  const subject = `Your OrBit Password Reset Code: ${verificationCode}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OrBit Password Reset Code</title>
    </head>
    <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color:#0a0808; border: 1px solid rgba(255, 0, 60, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px rgba(255, 0, 60, 0.2);">
              <tr>
                <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                    ORBIT<span style="color: #ff003c;">.SECURITY</span>
                  </div>
                  <div style="color: #ff4c75; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; font-weight: bold;">
                    🔐 Password Reset Handshake
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 35px;">
                  <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                    Reset Your Password
                  </h2>
                  <p style="margin: 0 0 20px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    We received a request to reset developer credentials for <strong style="color: #ffffff;">${targetEmail}</strong>.
                  </p>
                  <p style="margin: 0 0 25px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    Use the 6-digit cryptographic verification code below to authorize setting a new password:
                  </p>
                  
                  <div style="background: #120d0e; border: 1.5px solid #ff003c; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 25px;">
                    <div style="font-family: monospace, Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ff003c; text-shadow: 0 0 15px rgba(255, 0, 60, 0.5);">
                      ${verificationCode}
                    </div>
                  </div>

                  <p style="margin: 0 0 10px 0; color: #808085; font-size: 12px; line-height: 1.5; text-align: center;">
                    ⏳ This code is valid for <strong style="color: #ff003c;">10 minutes</strong>.
                  </p>
                  <div style="background: rgba(255, 76, 117, 0.08); border: 1px solid rgba(255, 76, 117, 0.2); border-radius: 8px; padding: 12px; margin-top: 20px;">
                    <p style="margin: 0; color: #ff4c75; font-size: 12px; line-height: 1.4; text-align: center;">
                      If you did not request a password reset, you can safely ignore this email. Your current password remains secure.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                  <p style="margin: 0; color: #505055; font-size: 11px;">
                    OrBit Mesh Protocol &bull; Zero-Knowledge P2P Infrastructure
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (resendApiKey) {
    try {
      console.log(`[Resend Mailer] Dispatching Password Reset OTP to ${targetEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Password Reset OTP successfully sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      } else {
        console.error('[Resend Mailer Error] API error on password reset OTP:', resData);
        return { success: false, error: resData };
      }
    } catch (err) {
      console.error('[Resend Mailer Error] Failed password reset OTP dispatch:', err);
      return { success: false, error: err };
    }
  } else {
    console.log(`=========================================`);
    console.log(`[Fallback Log] FORGOT PASSWORD RESET OTP CODE`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Verification Code: ${verificationCode}`);
    console.log(`=========================================`);
    return { success: true, fallback: true };
  }
};

export const sendPaymentReceiptEmail = async (
  targetEmail: string,
  details: { planTier: string; amount: string; paymentId: string; licenseKey: string }
) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;

  const subject = `Your OrBit ${details.planTier} Subscription Confirmation`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OrBit Subscription Confirmation</title>
    </head>
    <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color:#0a0808; border: 1px solid rgba(0, 230, 118, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px rgba(0, 230, 118, 0.15);">
              <tr>
                <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                    ORBIT<span style="color: #00e676;">.BILLING</span>
                  </div>
                  <div style="color: #00e676; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; font-weight: bold;">
                    ✓ Payment Confirmed &bull; Subscription Active
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 35px;">
                  <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                    Thank you for upgrading!
                  </h2>
                  <p style="margin: 0 0 25px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    Your account <strong style="color: #ffffff;">${targetEmail}</strong> has been successfully elevated to the <strong style="color: #00e676;">${details.planTier}</strong> tier.
                  </p>
                  
                  <div style="background: #060505; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                    <table border="0" cellpadding="6" cellspacing="0" width="100%" style="font-size: 13px; color: #d0d0d5;">
                      <tr>
                        <td style="color: #707075;">Plan Tier:</td>
                        <td style="text-align: right; color: #ffffff; font-weight: bold;">${details.planTier}</td>
                      </tr>
                      <tr>
                        <td style="color: #707075;">Amount Paid:</td>
                        <td style="text-align: right; color: #00e676; font-weight: bold;">${details.amount}</td>
                      </tr>
                      <tr>
                        <td style="color: #707075;">Transaction ID:</td>
                        <td style="text-align: right; font-family: monospace; color: #90caf9; font-size: 12px;">${details.paymentId}</td>
                      </tr>
                      <tr>
                        <td style="color: #707075;">Device Allocation:</td>
                        <td style="text-align: right; color: #ffffff; font-weight: bold;">10 Active Nodes</td>
                      </tr>
                    </table>
                  </div>

                  <div style="background: rgba(255, 0, 60, 0.06); border: 1px solid rgba(255, 0, 60, 0.25); border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                    <div style="color: #808085; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your Permanent License Key</div>
                    <div style="font-family: monospace; font-size: 16px; font-weight: bold; color: #ff003c; letter-spacing: 1px; word-break: break-all;">
                      ${details.licenseKey}
                    </div>
                  </div>

                  <p style="margin: 0; color: #808085; font-size: 12px; line-height: 1.5; text-align: center;">
                    Paste this License Key in OrBit Desktop to authenticate your computers.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                  <p style="margin: 0; color: #505055; font-size: 11px;">
                    OrBit Mesh Protocol &bull; Zero-Knowledge P2P Infrastructure
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (resendApiKey) {
    try {
      console.log(`[Resend Mailer] Dispatching Subscription Receipt to ${targetEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Subscription Receipt successfully sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      } else {
        console.error('[Resend Mailer Error] API error on receipt:', resData);
        return { success: false, error: resData };
      }
    } catch (err) {
      console.error('[Resend Mailer Error] Failed receipt dispatch:', err);
      return { success: false, error: err };
    }
  } else {
    console.log(`=========================================`);
    console.log(`[Fallback Log] SUBSCRIPTION RECEIPT`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Plan: ${details.planTier}`);
    console.log(`=========================================`);
    return { success: true, fallback: true };
  }
};

export const sendEnterpriseOtpEmail = async (
  targetEmail: string,
  verificationCode: string,
  companyName: string = 'Organization',
  isLogin: boolean = false
) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;

  const subject = isLogin
    ? `OrBit Enterprise: Login Security Code for ${companyName} (${verificationCode})`
    : `OrBit Enterprise: Verify Registration for ${companyName} (${verificationCode})`;

  const actionTitle = isLogin
    ? 'Enterprise Sign-In Verification'
    : 'Organization Onboarding Handshake';

  const actionDescription = isLogin
    ? `A sign-in attempt was initiated for corporate administrator account <strong style="color: #ffffff;">${targetEmail}</strong> associated with <strong style="color: #00e676;">${companyName}</strong>.`
    : `You are registering <strong style="color: #ffffff;">${companyName}</strong> on the OrBit Enterprise Grid with corporate email <strong style="color: #ffffff;">${targetEmail}</strong>.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color:#0a0808; border: 1.5px solid rgba(0, 230, 118, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 0 45px rgba(0, 230, 118, 0.15);">
              <tr>
                <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: #070908;">
                  <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                    ORBIT<span style="color: #00e676;">.ENTERPRISE</span>
                  </div>
                  <div style="color: #00e676; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; font-weight: bold;">
                    🏢 Zero-Trust Organization Identity Guard
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 35px;">
                  <div style="display: inline-block; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 20px; padding: 4px 12px; margin-bottom: 14px; font-size: 11px; font-weight: 700; color: #00e676; text-transform: uppercase; letter-spacing: 1px;">
                    ${companyName}
                  </div>
                  <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 21px; font-weight: 700; letter-spacing: -0.5px;">
                    ${actionTitle}
                  </h2>
                  <p style="margin: 0 0 20px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    ${actionDescription}
                  </p>
                  <p style="margin: 0 0 25px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
                    Enter the 6-digit cryptographic security code below to complete authorization:
                  </p>
                  
                  <div style="background: #09120c; border: 1.5px solid #00e676; border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 25px; box-shadow: 0 0 25px rgba(0, 230, 118, 0.2);">
                    <div style="font-family: monospace, Courier, monospace; font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #00e676; text-shadow: 0 0 16px rgba(0, 230, 118, 0.6);">
                      ${verificationCode}
                    </div>
                  </div>

                  <p style="margin: 0 0 12px 0; color: #808085; font-size: 12px; line-height: 1.5; text-align: center;">
                    ⏳ This code is valid for <strong style="color: #00e676;">10 minutes</strong>.
                  </p>
                  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px; margin-top: 20px;">
                    <p style="margin: 0; color: #88888e; font-size: 11px; line-height: 1.4; text-align: center;">
                      Enterprise Security Notice: Do not forward or share this code with anyone. OrBit personnel will never ask for your authentication codes.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                  <p style="margin: 0; color: #505055; font-size: 11px;">
                    OrBit Enterprise Mesh &bull; Zero-Knowledge P2P Infrastructure &bull; SOC2 / ISO27001 Ready
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (resendApiKey) {
    try {
      console.log(`[Resend Mailer] Dispatching Enterprise OTP email to ${targetEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Enterprise OTP email successfully sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      } else {
        console.error('[Resend Mailer Error] API error on Enterprise OTP:', resData);
        return { success: false, error: resData };
      }
    } catch (err) {
      console.error('[Resend Mailer Error] Failed Enterprise OTP dispatch:', err);
      return { success: false, error: err };
    }
  } else {
    console.log(`=========================================`);
    console.log(`[Fallback Log] ENTERPRISE OTP CODE`);
    console.log(`Recipient: ${targetEmail}`);
    console.log(`Company: ${companyName}`);
    console.log(`Type: ${isLogin ? 'LOGIN' : 'SIGNUP'}`);
    console.log(`Verification Code: ${verificationCode}`);
    console.log(`=========================================`);
    return { success: true, fallback: true };
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const waitlistEmailShell = (inner: string, accent: string = '#ff003c') => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0; padding:0; background-color:#030303; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#030303; padding: 40px 10px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color:#0a0808; border: 1px solid ${accent}66; border-radius: 16px; overflow: hidden; box-shadow: 0 0 40px ${accent}26;">
            <tr>
              <td style="padding: 35px 35px 20px 35px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <div style="font-family: monospace, Courier, monospace; font-size: 24px; font-weight: 900; letter-spacing: 3px; color: #ffffff; text-transform: uppercase;">
                  ORBIT<span style="color: ${accent};">.SYNC</span>
                </div>
                <div style="color: #808085; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px;">
                  Local-First Synchronization Engine
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 35px;">
                ${inner}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 35px; background: #060505; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
                <p style="margin: 0; color: #505055; font-size: 11px;">
                  OrBit Mesh Protocol &bull; Zero-Knowledge P2P Infrastructure
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;

export const sendWaitlistConfirmationEmail = async (targetEmail: string, confirmUrl: string) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;
  const safeEmail = escapeHtml(targetEmail);
  const safeUrl = escapeHtml(confirmUrl);

  const subject = 'Confirm your OrBit early access and claim 50% off';
  const htmlContent = waitlistEmailShell(`
    <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 21px; font-weight: 700; letter-spacing: -0.5px;">
      One click to lock in 50% off
    </h2>
    <p style="margin: 0 0 18px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
      You asked to be notified when OrBit launches. Confirm <strong style="color: #ffffff;">${safeEmail}</strong> and we will reserve your early-bird discount.
    </p>
    <div style="background: rgba(255, 0, 60, 0.06); border: 1px solid rgba(255, 0, 60, 0.25); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #ff859f; font-size: 13px; line-height: 1.5;">
        Confirmed members receive a personal 50% launch code, launch-day access, and product updates. No spam.
      </p>
    </div>
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${safeUrl}" style="display: inline-block; background: #ff003c; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 8px;">
        Confirm my early access
      </a>
    </div>
    <p style="margin: 0; color: #606065; font-size: 11px; line-height: 1.5; text-align: center;">
      This link expires in 48 hours. If the button does not work, paste this URL into your browser:<br>
      <span style="color: #808085; word-break: break-all;">${safeUrl}</span>
    </p>
  `);

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Waitlist confirmation sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      }
      console.error('[Resend Mailer Error] Waitlist confirmation failed:', resData);
      return { success: false, error: resData };
    } catch (err) {
      console.error('[Resend Mailer Error] Waitlist confirmation dispatch failed:', err);
      return { success: false, error: err };
    }
  }

  console.log(`=========================================`);
  console.log(`[Fallback Log] WAITLIST CONFIRMATION`);
  console.log(`Recipient: ${targetEmail}`);
  console.log(`Confirm URL: ${confirmUrl}`);
  console.log(`=========================================`);
  return { success: true, fallback: true };
};

export const sendWaitlistWelcomeEmail = async (
  targetEmail: string,
  details: { referralCode: string; discountCode: string; referralUrl: string; position: number }
) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;
  const safeEmail = escapeHtml(targetEmail);
  const safeDiscount = escapeHtml(details.discountCode);
  const safeReferralUrl = escapeHtml(details.referralUrl);

  const subject = `You are in: your OrBit 50% early-bird code is ${details.discountCode}`;
  const htmlContent = waitlistEmailShell(`
    <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 21px; font-weight: 700; letter-spacing: -0.5px;">
      You are on the launch list
    </h2>
    <p style="margin: 0 0 20px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
      <strong style="color: #ffffff;">${safeEmail}</strong> is confirmed. You are #${details.position} in line for OrBit launch access.
    </p>

    <div style="background: rgba(255, 0, 60, 0.06); border: 1px solid rgba(255, 0, 60, 0.25); border-radius: 10px; padding: 18px; margin-bottom: 22px;">
      <div style="color: #808085; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your 50% early-bird code</div>
      <div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #ff003c; letter-spacing: 1px; word-break: break-all;">
        ${safeDiscount}
      </div>
    </div>

    <p style="margin: 0 0 18px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
      Use this code at checkout when OrBit launches. It is tied to your account, single-use, and valid for 90 days.
    </p>

    <div style="background: #060505; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <div style="color: #808085; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Share your invite link</div>
      <div style="font-family: monospace; font-size: 12px; color: #90caf9; word-break: break-all;">
        ${safeReferralUrl}
      </div>
    </div>

    <p style="margin: 0; color: #606065; font-size: 11px; line-height: 1.5; text-align: center;">
      Referral code: <span style="color: #808085; font-family: monospace;">${escapeHtml(details.referralCode)}</span>
    </p>
  `);

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Waitlist welcome sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      }
      console.error('[Resend Mailer Error] Waitlist welcome failed:', resData);
      return { success: false, error: resData };
    } catch (err) {
      console.error('[Resend Mailer Error] Waitlist welcome dispatch failed:', err);
      return { success: false, error: err };
    }
  }

  console.log(`=========================================`);
  console.log(`[Fallback Log] WAITLIST WELCOME`);
  console.log(`Recipient: ${targetEmail}`);
  console.log(`Discount Code: ${details.discountCode}`);
  console.log(`Referral URL: ${details.referralUrl}`);
  console.log(`Position: ${details.position}`);
  console.log(`=========================================`);
  return { success: true, fallback: true };
};

export const sendWaitlistLaunchReminderEmail = async (
  targetEmail: string,
  details: { discountCode: string; referralCode: string; referralUrl: string; position: number }
) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_SENDER;
  const safeEmail = escapeHtml(targetEmail);
  const safeDiscount = escapeHtml(details.discountCode);
  const safeReferralUrl = escapeHtml(details.referralUrl);

  const subject = 'OrBit launch reminder: your 50% early-bird code is ready';
  const htmlContent = waitlistEmailShell(`
    <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 21px; font-weight: 700; letter-spacing: -0.5px;">
      Launch is approaching
    </h2>
    <p style="margin: 0 0 18px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
      Heads up, <strong style="color: #ffffff;">${safeEmail}</strong>. You are #${details.position} on the OrBit launch list. Your early-bird access is reserved.
    </p>

    <div style="background: rgba(255, 0, 60, 0.06); border: 1px solid rgba(255, 0, 60, 0.25); border-radius: 10px; padding: 18px; margin-bottom: 22px;">
      <div style="color: #808085; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Redeem at launch</div>
      <div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #ff003c; letter-spacing: 1px; word-break: break-all;">
        ${safeDiscount}
      </div>
    </div>

    <p style="margin: 0 0 18px 0; color: #a0a0a5; font-size: 14px; line-height: 1.6;">
      Use this single-use 50% code at checkout when OrBit launches. It is valid for 90 days and tied to your confirmed email.
    </p>

    <div style="background: #060505; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <div style="color: #808085; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Share your invite link</div>
      <div style="font-family: monospace; font-size: 12px; color: #90caf9; word-break: break-all;">
        ${safeReferralUrl}
      </div>
    </div>

    <p style="margin: 0; color: #606065; font-size: 11px; line-height: 1.5; text-align: center;">
      Referral code: <span style="color: #808085; font-family: monospace;">${escapeHtml(details.referralCode)}</span>
    </p>
  `);

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderFrom,
          to: [targetEmail],
          subject,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (response.ok) {
        console.log(`[Resend Mailer] Waitlist launch reminder sent! ID: ${resData.id}`);
        return { success: true, id: resData.id };
      }
      console.error('[Resend Mailer Error] Waitlist launch reminder failed:', resData);
      return { success: false, error: resData };
    } catch (err) {
      console.error('[Resend Mailer Error] Waitlist launch reminder dispatch failed:', err);
      return { success: false, error: err };
    }
  }

  console.log(`=========================================`);
  console.log(`[Fallback Log] WAITLIST LAUNCH REMINDER`);
  console.log(`Recipient: ${targetEmail}`);
  console.log(`Discount Code: ${details.discountCode}`);
  console.log(`Referral Code: ${details.referralCode}`);
  console.log(`Position: ${details.position}`);
  console.log(`=========================================`);
  return { success: true, fallback: true };
};

