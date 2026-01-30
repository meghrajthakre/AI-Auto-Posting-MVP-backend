import crypto from "crypto";
import Repository from "../models/repository.js";

/**
 * GITHUB WEBHOOK HANDLER
 */
export const githubWebhookHandler = async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];

    if (!signature) {
      return res.status(401).send("Missing signature");
    }

    const payload = JSON.stringify(req.body);

    // 1️⃣ Find repo
    const repoFullName = req.body.repository.full_name;
    const repository = await Repository.findOne({ repoFullName });

    if (!repository) {
      return res.status(404).send("Repository not registered");
    }

    // 2️⃣ Verify signature
    const hmac = crypto.createHmac("sha256", repository.webhookSecret);
    const digest = `sha256=${hmac.update(payload).digest("hex")}`;

    if (digest !== signature) {
      return res.status(401).send("Invalid signature");
    }

    // 3️⃣ Handle events
    if (event === "push") {
      console.log("🔥 Push detected on:", repoFullName);

      // 👉 Yaha tu:
      // - commits parse kare
      // - AI post generate kare
      // - LinkedIn / X pe auto-post kare
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("GitHub webhook error:", error);
    res.status(500).send("Webhook error");
  }
};
