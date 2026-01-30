import express from "express";
import { githubWebhookHandler } from "../controllers/githubWebhookController.js";

const router = express.Router();

/**
 * GITHUB WEBHOOK
 * POST /api/webhooks/github
 */
router.post("/webhooks/github", githubWebhookHandler);

export default router;
