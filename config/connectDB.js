import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://meghrajthakre444_db_user:${process.env.MONGODB_PASSWORD}@ai-power-posts.vv2oldi.mongodb.net/auto-post-ai`
    );
    console.log("MongoDB Connected ✅");
  } catch (error) {
    console.error("MongoDB Error ❌", error.message);
    process.exit(1);
  }
};

export default connectDB;
