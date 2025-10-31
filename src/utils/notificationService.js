const twilio = require('twilio');
const { sendEmail } = require('./emailService');

// Twilio configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Send SMS notification
const sendSMS = async ({ to, message }) => {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('Twilio not configured, SMS not sent');
      return null;
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to
    });

    console.log('SMS sent successfully:', result.sid);
    return result;
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    throw error;
  }
};

// Send push notification (using OneSignal or similar service)
const sendPushNotification = async ({ userId, title, message, data = {} }) => {
  try {
    // Placeholder for OneSignal implementation
    // You would integrate with OneSignal API here
    console.log('Push notification:', { userId, title, message, data });
    
    // Example OneSignal implementation:
    // const axios = require('axios');
    // await axios.post('https://onesignal.com/api/v1/notifications', {
    //   app_id: process.env.ONESIGNAL_APP_ID,
    //   include_external_user_ids: [userId],
    //   headings: { en: title },
    //   contents: { en: message },
    //   data
    // }, {
    //   headers: {
    //     'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   }
    // });

    return { success: true };
  } catch (error) {
    console.error('Push notification failed:', error.message);
    throw error;
  }
};

// Send appointment reminder
const sendAppointmentReminder = async ({ user, appointment, method = 'all' }) => {
  try {
    const appointmentDate = new Date(appointment.appointmentDate).toLocaleDateString();
    const appointmentTime = appointment.appointmentTime;
    const doctorName = appointment.medicalPersonnelId 
      ? `${appointment.medicalPersonnelId.firstName} ${appointment.medicalPersonnelId.lastName}`
      : 'Your doctor';

    const message = `Reminder: You have an appointment with ${doctorName} on ${appointmentDate} at ${appointmentTime}. Meeting link: ${appointment.meetingLink || 'N/A'}`;

    const results = {};

    // Send email
    if ((method === 'all' || method === 'email') && user.notificationPreferences?.email) {
      results.email = await sendEmail({
        to: user.email,
        template: 'appointment',
        data: {
          firstName: user.firstName,
          appointmentDate,
          appointmentTime,
          appointmentType: appointment.type,
          doctorName,
          meetingLink: appointment.meetingLink || 'To be provided'
        }
      });
    }

    // Send SMS
    if ((method === 'all' || method === 'sms') && user.notificationPreferences?.sms && user.phone) {
      results.sms = await sendSMS({
        to: user.phone,
        message
      });
    }

    // Send push notification
    if ((method === 'all' || method === 'push') && user.notificationPreferences?.push) {
      results.push = await sendPushNotification({
        userId: user._id.toString(),
        title: 'Appointment Reminder',
        message,
        data: { appointmentId: appointment._id.toString() }
      });
    }

    return results;
  } catch (error) {
    console.error('Send appointment reminder failed:', error.message);
    throw error;
  }
};

// Send order update notification
const sendOrderUpdate = async ({ user, order, status }) => {
  try {
    const orderNumber = order.trackingNumber;
    const statusMessages = {
      confirmed: 'Your order has been confirmed and is being prepared.',
      preparing: 'Your order is being prepared.',
      'out-for-delivery': 'Your order is out for delivery!',
      delivered: 'Your order has been delivered. Enjoy!',
      cancelled: 'Your order has been cancelled.'
    };

    const message = `Order ${orderNumber}: ${statusMessages[status] || 'Status updated'}`;

    const results = {};

    // Send email
    if (user.notificationPreferences?.email) {
      results.email = await sendEmail({
        to: user.email,
        subject: `Order Update - ${orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Order Update</h2>
            <p>Dear ${user.firstName},</p>
            <p>${statusMessages[status]}</p>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Status:</strong> ${status}</p>
            ${order.estimatedDeliveryTime ? `<p><strong>Estimated Delivery:</strong> ${new Date(order.estimatedDeliveryTime).toLocaleString()}</p>` : ''}
            <p>Thank you for using MCaid!</p>
          </div>
        `
      });
    }

    // Send SMS
    if (user.notificationPreferences?.sms && user.phone) {
      results.sms = await sendSMS({
        to: user.phone,
        message
      });
    }

    // Send push notification
    if (user.notificationPreferences?.push) {
      results.push = await sendPushNotification({
        userId: user._id.toString(),
        title: 'Order Update',
        message,
        data: { orderId: order._id.toString() }
      });
    }

    return results;
  } catch (error) {
    console.error('Send order update failed:', error.message);
    throw error;
  }
};

// Send new message notification
const sendMessageNotification = async ({ user, senderName, preview }) => {
  try {
    const message = `New message from ${senderName}: ${preview}`;

    const results = {};

    // Send push notification
    if (user.notificationPreferences?.push) {
      results.push = await sendPushNotification({
        userId: user._id.toString(),
        title: `New message from ${senderName}`,
        message: preview,
        data: { type: 'chat' }
      });
    }

    return results;
  } catch (error) {
    console.error('Send message notification failed:', error.message);
    throw error;
  }
};

// Send health alert
const sendHealthAlert = async ({ user, alertType, message }) => {
  try {
    const results = {};

    // Send email for high priority alerts
    if (user.notificationPreferences?.email) {
      results.email = await sendEmail({
        to: user.email,
        subject: `Health Alert - ${alertType}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">Health Alert</h2>
            <p>Dear ${user.firstName},</p>
            <p>${message}</p>
            <p><strong>Please consult with your healthcare provider if you have concerns.</strong></p>
            <p>Stay safe,<br>The MCaid Team</p>
          </div>
        `
      });
    }

    // Send SMS
    if (user.notificationPreferences?.sms && user.phone) {
      results.sms = await sendSMS({
        to: user.phone,
        message: `Health Alert: ${message}`
      });
    }

    // Send push notification
    if (user.notificationPreferences?.push) {
      results.push = await sendPushNotification({
        userId: user._id.toString(),
        title: `Health Alert - ${alertType}`,
        message,
        data: { type: 'health-alert', alertType }
      });
    }

    return results;
  } catch (error) {
    console.error('Send health alert failed:', error.message);
    throw error;
  }
};

module.exports = {
  sendSMS,
  sendPushNotification,
  sendAppointmentReminder,
  sendOrderUpdate,
  sendMessageNotification,
  sendHealthAlert
};
