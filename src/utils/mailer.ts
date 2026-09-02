// OrBit Security - Centralized Resend Email Dispatcher

export const sendVerificationEmail = async (targetEmail: string, verificationCode: string) => {
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderFrom = process.env.RESEND_FROM_EMAIL || 'OrBit Security <onboarding@resend.dev>';

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
  const senderFrom = process.env.RESEND_FROM_EMAIL || 'OrBit Security <onboarding@resend.dev>';

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
