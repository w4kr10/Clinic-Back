const mongoose = require('mongoose');

const pregnancyRecordSchema = new mongoose.Schema({
  motherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  currentWeek: {
    type: Number,
    required: true,
  },
  trimester: {
    type: String,
    enum: ['first', 'second', 'third'],
    required: true,
  },
  healthMetrics: {
    weight: {
      type: Number,
    },
    bloodPressure: {
      systolic: Number,
      diastolic: Number,
    },
    bloodSugar: {
      type: Number,
    },
    heartRate: {
      type: Number,
    },
  },
  symptoms: [{
    name: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: true,
    },
    notes: String,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
  medications: [{
    name: {
      type: String,
      required: true,
    },
    dosage: String,
    frequency: String,
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startDate: Date,
    endDate: Date,
  }],
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  }],
  notes: [{
    content: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('PregnancyRecord', pregnancyRecordSchema);
