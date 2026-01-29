import mongoose from "mongoose";

const oauthStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platform: {
      type: String,
      enum: ["twitter"],
      required: true,
    },
    state: {
      type: String,
      required: true,
      unique: true,
    },
    codeVerifier: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("OAuthState", oauthStateSchema);
