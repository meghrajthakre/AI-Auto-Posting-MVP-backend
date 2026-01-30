import axios from "axios";
import Repository from "../models/repository.js";
import ConnectedAccount from "../models/connectedAcoounts.js";

/**
 * ADD GITHUB REPOSITORY + CREATE WEBHOOK
 */
export const addRepository = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      githubRepoId,
      repoName,
      repoFullName,
      autoPostEnabled = true,
      postGenerationSettings = {}
    } = req.body;

    // 1️⃣ Validation
    if (!githubRepoId || !repoName || !repoFullName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // 2️⃣ Prevent duplicate
    const exists = await Repository.findOne({ userId, githubRepoId });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Repository already added"
      });
    }

    // 3️⃣ Get GitHub account
    const githubAccount = await ConnectedAccount.findOne({
      userId,
      platform: "github",
      isActive: true
    }).select("+accessToken");

    if (!githubAccount) {
      return res.status(400).json({
        success: false,
        message: "GitHub account not connected"
      });
    }

    const accessToken = githubAccount.decryptToken("access");

    // repoFullName → owner/repo
    const [owner, repo] = repoFullName.split("/");

    // 4️⃣ Generate webhook secret
    const tempRepo = new Repository();
    const webhookSecret = tempRepo.generateWebhookSecret();

    // 5️⃣ Create GitHub webhook
    const webhookRes = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: `${process.env.WEBHOOK_BASE_URL}/api/webhooks/github`,
          content_type: "json",
          secret: webhookSecret
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    // 6️⃣ Save repository
    const repository = await Repository.create({
      userId,
      githubRepoId,
      repoName,
      repoFullName,
      repoUrl: `https://github.com/${repoFullName}`,
      autoPostEnabled,
      postGenerationSettings,
      webhookId: webhookRes.data.id,
      webhookSecret,
      webhookUrl: webhookRes.data.config.url,
      isWebhookActive: true
    });

    // 7️⃣ Response
    res.status(201).json({
      success: true,
      data: {
        id: repository._id,
        repoName: repository.repoName,
        webhookId: repository.webhookId,
        isWebhookActive: repository.isWebhookActive
      }
    });
  } catch (error) {
    console.error("Add repository error:", error.response?.data || error);

    res.status(500).json({
      success: false,
      message: "Failed to add repository"
    });
  }
};
