const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  ignoreTLS: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
};

console.log("Current Transporter configuration:", smtpConfig);
console.log("Sender (SMTP_FROM):", process.env.SMTP_FROM);

const transporter = nodemailer.createTransport(smtpConfig);

function loadTemplate(templateName, variables = {}) {
  const templatePath = path.join(__dirname, `./templates/${templateName}.html`);
  let html = fs.readFileSync(templatePath, "utf8");

  Object.entries(variables).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
  });

  return html;
}

async function sendEmail(to, subject, templateName, variables = {}) {
  console.log(`Trying to send email to ${to}...`);

  try {
    const htmlContent = loadTemplate(templateName, variables);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: htmlContent,
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  transporter,
};
