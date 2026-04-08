// src/services/mailer.js
// Nodemailer transporter using Gmail + App Password.
// Required env vars:
//   GMAIL_USER         — the Gmail address (e.g. papyrusstudy@gmail.com)
//   GMAIL_APP_PASSWORD — 16-char App Password from Google Account → Security → App Passwords
//   FRONTEND_URL       — base URL of the frontend (used in verification links)

const nodemailer = require('nodemailer');

// P3: Use env var so the sender address is configurable without changing code
const GMAIL_USER = process.env.GMAIL_USER || 'papyrusstudy@gmail.com';

// P2: Warn loudly at startup if email credentials are missing.
// Without this, registrations silently succeed but users never get the verification email.
if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn('[mailer] ⚠️  GMAIL_APP_PASSWORD not set — verification emails will NOT be sent.');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// P3: Verify SMTP connection at startup in dev so config errors are caught immediately
// rather than discovered when the first user registers.
if (process.env.NODE_ENV !== 'production') {
    transporter.verify().then(() => {
        console.log('[mailer] ✅ SMTP connection verified — email is ready.');
    }).catch((err) => {
        console.warn('[mailer] ⚠️  SMTP connection failed:', err.message);
    });
}

// P1: Escape HTML entities in user-provided strings before embedding in HTML templates.
// Prevents name values like <img src=x onerror="..."> from being injected into the email.
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Send an account verification email.
 * @param {string} toEmail  - Recipient email address
 * @param {string} toName   - Recipient's full name (HTML-escaped before use)
 * @param {string} token    - The raw verification token (32-byte hex)
 */
async function sendVerificationEmail(toEmail, toName, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl   = `${frontendUrl}/verify-email?token=${token}`;
    const safeName    = escapeHtml(toName); // P1: sanitize before embedding in HTML

    await transporter.sendMail({
        from: `"Papyrus Study" <${GMAIL_USER}>`,
        to: toEmail,
        subject: 'Verify your Papyrus account',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:36px 40px;text-align:center;">
              <span style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                📖 Papyrus
              </span>
              <p style="margin:8px 0 0;color:#ff6900;font-size:13px;letter-spacing:1px;text-transform:uppercase;">
                Study Smarter
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a1a2e;">
                Welcome, ${safeName}! 👋
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                You're one step away from starting your learning journey.
                Click the button below to verify your email address and activate your account.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#ff6900;border-radius:10px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                      ✅ Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#999;">
                This link expires in <strong>24 hours</strong>.
                If you didn't create this account, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:12px;color:#bbb;word-break:break-all;">
                Or copy this link: ${verifyUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                © ${new Date().getFullYear()} Papyrus Study · ${GMAIL_USER}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
    });
}

/**
 * Send a password reset email.
 * @param {string} toEmail - Recipient email address
 * @param {string} toName  - Recipient's full name
 * @param {string} token   - The raw reset token (32-byte hex)
 */
async function sendPasswordResetEmail(toEmail, toName, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl    = `${frontendUrl}/reset-password?token=${token}`;
    const safeName    = escapeHtml(toName);

    await transporter.sendMail({
        from: `"Papyrus Study" <${GMAIL_USER}>`,
        to: toEmail,
        subject: 'Reset your Papyrus password',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:36px 40px;text-align:center;">
              <span style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">📖 Papyrus</span>
              <p style="margin:8px 0 0;color:#ff6900;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Study Smarter</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a1a2e;">Reset your password 🔐</h2>
              <p style="margin:0 0 8px;font-size:15px;color:#555;line-height:1.6;">
                Hi ${safeName}, we received a request to reset your Papyrus password.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#ff6900;border-radius:10px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                      🔑 Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#999;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will not change.
              </p>
              <p style="margin:0;font-size:12px;color:#bbb;word-break:break-all;">
                Or copy this link: ${resetUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                © ${new Date().getFullYear()} Papyrus Study · ${GMAIL_USER}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
    });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };

