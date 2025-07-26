const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
  },

  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters long"],
    select: false,
  },
  avatar: {
    type: String,
    trim: true,
    default: null // URL or path to avatar image
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [150, "Bio cannot be longer than 150 characters"],
    default: ""
  },
  status: {
    type: String,
    enum: ["online", "offline", "away", "busy"],
    default: "offline"
  },
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null
  },
  clanRole: {
    type: String,
    enum: ["Leader", "SubLeader", "member", "leader", "subleader", null],
    default: null
  },
  federation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Federation",
    default: null
  },
  federationRole: {
    type: String,
    enum: ["leader", "subleader", "member", null],
    default: null
  },
  role: {
    type: String,
    enum: ["ADM", "adminReivindicado", "user", "descolado"],
    default: "user"
  },
  online: { type: Boolean, default: false },
  ultimaAtividade: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  // Campos para controle de reset de senha
  mustChangePasswordOnNextLogin: {
    type: Boolean,
    default: false
  },
  passwordResetBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  passwordResetAt: {
    type: Date,
    default: null
  },
  fcmToken: {
    type: String,
    trim: true,
    default: null
  }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (enteredPassword) {
  const userWithPassword = await mongoose.model("User").findById(this._id).select("+password");
  if (!userWithPassword) {
    throw new Error("User not found during password comparison.");
  }
  return await bcrypt.compare(enteredPassword, userWithPassword.password);
};

UserSchema.virtual("isOnline").get(function() {
  return this.lastSeen && (new Date() - this.lastSeen < 5 * 60 * 1000);
});

// Adicionando índices para campos frequentemente consultados (removendo duplicatas)
// username já tem índice único via schema definition
UserSchema.index({ clan: 1 });
UserSchema.index({ federation: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ online: 1 });
UserSchema.index({ ultimaAtividade: 1 });
UserSchema.index({ lastSeen: 1 });

module.exports = mongoose.model("User", UserSchema);


