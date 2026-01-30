import express from "express";
import { getAllPosts } from "../controllers/getAllPosts.js";
import authMiddleware from "../middleware/authMiddleware.js";
const router = express.Router();

router.get(
  "/posts",
  authMiddleware,
  getAllPosts

);

export default router;