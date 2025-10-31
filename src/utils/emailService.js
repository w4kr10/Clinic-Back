const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Email templates
const templates = {
  welcome: (data) => ({
    subject: 'Welcome to MCaid!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to MCaid!</h2>
        <p>Dear ${data.firstName},</p>
        <p>Welcome to MCaid - your comprehensive health monitoring platform for pregnancy care.</p>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${data.verificationLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>If you didn't create this account, please ignore this email.</p>
        <p>Best regards,<br>The MCaid Team</p>
      </div>
    `,
  }),
  appointment: (data) => ({
    subject: 'Appointment Reminder - MCaid',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Appointment Reminder</h2>
        <p>Dear ${data.firstName},</p>
        <p>This is a reminder for your upcoming appointment:</p>
        <ul>
          <li><strong>Date:</strong> ${data.appointmentDate}</li>
          <li><strong>Time:</strong> ${data.appointmentTime}</li>
          <li><strong>Type:</strong> ${data.appointmentType}</li>
          <li><strong>Doctor:</strong> ${data.doctorName}</li>
        </ul>
        <p>Please join the meeting using this link: <a href="${data.meetingLink}">Join Meeting</a></p>
        <p>Best regards,<br>The MCaid Team</p>
      </div>
    `,
  }),
  orderConfirmation: (data) => ({
    subject: 'Order Confirmation - MCaid',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Order Confirmation</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your order has been confirmed and is being prepared:</p>
        <ul>
          <li><strong>Order ID:</strong> ${data.orderId}</li>
          <li><strong>Total Amount:</strong> $${data.totalAmount}</li>
          <li><strong>Delivery Date:</strong> ${data.deliveryDate}</li>
          <li><strong>Delivery Time:</strong> ${data.deliveryTime}</li>
        </ul>
        <p>You will receive updates on your order status.</p>
        <p>Best regards,<br>The MCaid Team</p>
      </div>
    `,
  }),
};

// Send email function
const sendEmail = async ({ to, subject, template, data, html, text }) => {
  try {
    const transporter = createTransporter();
    
    let emailContent;
    if (template && templates[template]) {
      emailContent = templates[template](data);
    } else {
      emailContent = { subject, html, text };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: emailContent.subject || subject,
      html: emailContent.html || html,
      text: emailContent.text || text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

// Send bulk emails
const sendBulkEmail = async (recipients, emailData) => {
  const promises = recipients.map(recipient => 
    sendEmail({ ...emailData, to: recipient.email })
  );
  
  try {
    const results = await Promise.allSettled(promises);
    return results;
  } catch (error) {
    console.error('Bulk email sending failed:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  templates,
};
