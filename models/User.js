const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
  },
  // Removed email field
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters long"],
    select: false, // Do not return password by default
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
      enum: ["online", "offline", "away", "busy"], // Example statuses
      default: "offline"
  },
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    default: null, // User starts without a clan
  },
  clanRole: {
      type: String,
      enum: ["leader", "member", null], // Role within the clan
      default: null
  },
  // Add other fields as needed, e.g., roles, online status
  // Added fields for online status tracking
  online: { type: Boolean, default: false },
  ultimaAtividade: { type: Date, default: Date.now }
}, { timestamps: true });

// Pre-save hook to hash password before saving a new user
UserSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare entered password with hashed password in database
// Need to explicitly select password for this method to work if select: false is used
UserSchema.methods.comparePassword = async function (enteredPassword) {
  // Fetch the user again with the password field selected
  const userWithPassword = await mongoose.model("User").findById(this._id).select("+password");
  if (!userWithPassword) {
      throw new Error("User not found during password comparison.");
  }
  return await bcrypt.compare(enteredPassword, userWithPassword.password);
};

// Add index for faster lookups if needed, e.g., on clan
// UserSchema.index({ clan: 1 });

module.exports = mongoose.model("User", UserSchema);

