const mongoose = require("mongoose");

const InstaClanPostSchema = new mongoose.Schema({
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Clan",
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, "Post content cannot be longer than 1000 characters"],
  },
  imageUrl: {
    type: String,
    trim: true,
    default: null,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  comments: [
    {
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      content: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, "Comment content cannot be longer than 500 characters"],
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("InstaClanPost", InstaClanPostSchema);


