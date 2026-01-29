import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/connectDB.js";
import authRouter from "./routes/authRouter.js";

const app = express();
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// middlewares
app.use(cors());


// routes
app.use("/api/auth", authRouter);


const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err.message);
    process.exit(1);
  });