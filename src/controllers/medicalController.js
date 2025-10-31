const Appointment = require('../models/Appointment');
const PregnancyRecord = require('../models/PregnancyRecord');
const User = require('../models/User');

// Get medical dashboard data
const getDashboard = async (req, res) => {
  try {
    const todayAppointments = await Appointment.find({
      medicalPersonnelId: req.user.id,
      appointmentDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }).populate('motherId', 'firstName lastName phone email profileImage');

    const upcomingAppointments = await Appointment.find({
      medicalPersonnelId: req.user.id,
      status: { $in: ['scheduled', 'confirmed'] },
      appointmentDate: { $gte: new Date() }
    }).populate('motherId', 'firstName lastName phone email').sort({ appointmentDate: 1 }).limit(10);

    const totalPatients = await Appointment.distinct('motherId', { medicalPersonnelId: req.user.id });

    res.json({
      success: true,
      data: {
        todayAppointments,
        upcomingAppointments,
        totalPatients: totalPatients.length
      }
    });
  } catch (error) {
    console.error('Medical dashboard error:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
};

// Get detailed patient information
const getPatientInfo = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Verify this medical personnel has appointments with this patient
    const hasAppointment = await Appointment.findOne({
      motherId: patientId,
      medicalPersonnelId: req.user.id
    });

    if (!hasAppointment) {
      return res.status(403).json({ message: 'Not authorized to view this patient\'s details' });
    }

    // Get patient's basic info
    const patient = await User.findOne({ 
      _id: patientId, 
      role: 'mother' 
    }).select('-password');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get pregnancy record with populated data
    const pregnancyRecord = await PregnancyRecord.findOne({ 
      motherId: patientId 
    })
    .populate('medications.prescribedBy', 'firstName lastName specialization');

    // Get all appointments with this patient
    const appointments = await Appointment.find({ 
      motherId: patientId,
      medicalPersonnelId: req.user.id
    })
    .sort({ appointmentDate: -1, appointmentTime: -1 });

    // Combine all data
    const patientData = {
      ...patient.toObject(),
      pregnancyRecord,
      appointments
    };

    res.json({ success: true, data: patientData });
  } catch (error) {
    console.error('Get patient details error:', error);
    res.status(500).json({ message: 'Failed to get patient details' });
  }
};

// Get all patients
const getPatients = async (req, res) => {
  try {
    const appointments = await Appointment.find({ medicalPersonnelId: req.user.id })
      .populate('motherId', 'firstName lastName phone email profileImage dueDate pregnancyStage')
      .sort({ createdAt: -1 });

    // Get unique patients
    const patientsMap = new Map();
    appointments.forEach(apt => {
      if (apt.motherId && !patientsMap.has(apt.motherId._id.toString())) {
        patientsMap.set(apt.motherId._id.toString(), apt.motherId);
      }
    });

    const patients = Array.from(patientsMap.values());

    res.json({ success: true, data: patients });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Failed to get patients' });
  }
};

// This function has been merged with getPatientInfo

// Get appointments
const getAppointments = async (req, res) => {
  try {
    const { status, date } = req.query;
    
    const filter = { medicalPersonnelId: req.user.id };
    
    if (status) {
      filter.status = status;
    }
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.appointmentDate = { $gte: startDate, $lte: endDate };
    }

    const appointments = await Appointment.find(filter)
      .populate('motherId', 'firstName lastName phone email profileImage')
      .sort({ appointmentDate: 1, appointmentTime: 1 });

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Failed to get appointments' });
  }
};

// Create appointment (for medical personnel)
const createAppointment = async (req, res) => {
  try {
    const { motherId, appointmentDate, appointmentTime, type, notes } = req.body;

    // Verify the mother exists
    const mother = await User.findById(motherId);
    if (!mother || mother.role !== 'mother') {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const appointment = new Appointment({
      motherId,
      medicalPersonnelId: req.user.id,
      appointmentDate,
      appointmentTime,
      type,
      notes,
      status: 'scheduled'
    });

    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('motherId', 'firstName lastName phone email profileImage');

    // Emit socket event for real-time notification to patient
    if (req.io) {
      req.io.to(motherId).emit('new-appointment', populatedAppointment);
    }

    res.status(201).json({ success: true, data: populatedAppointment });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
};

// Update appointment
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, meetingLink } = req.body;

    const appointment = await Appointment.findOne({
      _id: id,
      medicalPersonnelId: req.user.id
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (status) appointment.status = status;
    if (notes) appointment.notes = notes;
    if (meetingLink) appointment.meetingLink = meetingLink;

    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('motherId', 'firstName lastName phone email');

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.to(appointment.motherId.toString()).emit('appointment-updated', updatedAppointment);
    }

    res.json({ success: true, data: updatedAppointment });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ message: 'Failed to update appointment' });
  }
};

// Add patient notes
const addPatientNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: id });
    
    if (!pregnancyRecord) {
      return res.status(404).json({ message: 'Pregnancy record not found' });
    }

    pregnancyRecord.notes.push({
      content,
      addedBy: req.user.id,
      date: new Date()
    });

    await pregnancyRecord.save();

    res.json({ success: true, data: pregnancyRecord });
  } catch (error) {
    console.error('Add patient notes error:', error);
    res.status(500).json({ message: 'Failed to add notes' });
  }
};

// Add medication to patient
const addMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dosage, frequency, startDate, endDate } = req.body;

    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: id });
    
    if (!pregnancyRecord) {
      return res.status(404).json({ message: 'Pregnancy record not found' });
    }

    pregnancyRecord.medications.push({
      name,
      dosage,
      frequency,
      prescribedBy: req.user.id,
      startDate,
      endDate
    });

    await pregnancyRecord.save();

    const populatedRecord = await PregnancyRecord.findById(pregnancyRecord._id)
      .populate('medications.prescribedBy', 'firstName lastName specialization');

    res.json({ success: true, data: populatedRecord });
  } catch (error) {
    console.error('Add medication error:', error);
    res.status(500).json({ message: 'Failed to add medication' });
  }
};

// Get analytics
const getAnalytics = async (req, res) => {
  try {
    const totalAppointments = await Appointment.countDocuments({ medicalPersonnelId: req.user.id });
    
    const completedAppointments = await Appointment.countDocuments({
      medicalPersonnelId: req.user.id,
      status: 'completed'
    });

    const upcomingAppointments = await Appointment.countDocuments({
      medicalPersonnelId: req.user.id,
      status: { $in: ['scheduled', 'confirmed'] },
      appointmentDate: { $gte: new Date() }
    });

    const totalPatients = await Appointment.distinct('motherId', { medicalPersonnelId: req.user.id });

    // Get appointments by month for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const appointmentsByMonth = await Appointment.aggregate([
      {
        $match: {
          medicalPersonnelId: req.user._id,
          appointmentDate: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: { 
            month: { $month: '$appointmentDate' },
            year: { $year: '$appointmentDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalAppointments,
        completedAppointments,
        upcomingAppointments,
        totalPatients: totalPatients.length,
        appointmentsByMonth
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Failed to get analytics' });
  }
};

module.exports = {
  getDashboard,
  getPatients,
  getPatientDetails: getPatientInfo, // Alias getPatientInfo as getPatientDetails for backward compatibility
  getAppointments,
  createAppointment,
  updateAppointment,
  addPatientNotes,
  addMedication,
  getAnalytics
};
