const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  motherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  medicalPersonnelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  appointmentDate: {
    type: Date,
    required: true,
  },
  appointmentTime: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    default: 30, // minutes
  },
  type: {
    type: String,
    enum: ['consultation', 'checkup', 'emergency', 'follow-up'],
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'scheduled',
  },
  notes: {
    type: String,
  },
  meetingLink: {
    type: String, // For teleconsultation
  },
  location: {
    type: String, // Physical location or "online"
    default: 'online',
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push'],
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
    },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Appointment', appointmentSchema);
