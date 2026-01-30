import Repository from "../models/repository.js";
import ConnectedAccount from "../models/ConnectedAccount.js";
import axios from "axios";

export const deleteRepository = async (req, res) => {
  try {
    const userId = req.user.id;
    const { repoId } = req.params;

    // 1️⃣ Find repository
    const repo = await Repository.findOne({
      id: repoId,
      userId
    }).select("+webhookSecret");

    if (!repo) {
      return res.status(404).json({
        success: false,
        message: "Repository not found"
      });
    }

    // 2️⃣ Delete GitHub webhook (if active)
    if (repo.isWebhookActive && repo.webhookId) {
      const githubAccount = await ConnectedAccount.findOne({
        userId,
        platform: "github",
        isActive: true
      }).select("+accessToken");

      if (githubAccount) {
        const accessToken = githubAccount.decryptToken("access");

        try {
          await axios.delete(
            `https://api.github.com/repos/${repo.repoFullName}/hooks/${repo.webhookId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github+json"
              }
            }
          );
        } catch (err) {
          console.warn("GitHub webhook deletion failed:", err.response?.data);
          // ⚠️ Don't fail deletion if webhook already gone
        }
      }
    }

    // 3️⃣ Remove repository from DB
    await repo.deleteOne();

    res.status(200).json({
      success: true,
      message: "Repository removed and webhook deleted"
    });

  } catch (error) {
    console.error("Delete repository error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete repository"
    });
  }
};
