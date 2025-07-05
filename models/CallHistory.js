// src/models/CallHistory.js
const mongoose = require('mongoose');

const CallHistorySchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callType: { type: String, enum: ['voice', 'video'], default: 'voice' },
  duration: { type: Number, default: 0 }, // duração em segundos
  status: { type: String, enum: ['pending', 'completed', 'missed', 'declined', 'failed'], default: 'pending' },
  roomId: { type: String, required: true },
  clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', required: false },
  federationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Federation', required: false },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('CallHistory', CallHistorySchema);
