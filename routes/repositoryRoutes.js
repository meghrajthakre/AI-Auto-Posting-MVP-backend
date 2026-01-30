import express from "express";
import axios from "axios";
import Repository from "../models/repository.js";
import ConnectedAccount from "../models/ConnectedAccount.js";
import authMiddleware from "../middleware/authMiddleware.js";
import axios from "axios";
import { addRepository } from "../controllers/repositoryController.js";
import { updateRepositorySettings } from "../controllers/updateRepositorySettings.js";
import { deleteRepository } from "../controllers/deleteRepository.js";
import { getRepositoryStats } from "../controllers/getRepositoryStats.js";

const router = express.Router();

// ===============================
// GET all active repositories
// ===============================
router.get("/repositories", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const repos = await Repository.find({
      userId,
      isActive: true
    }).sort({ connectedAt: -1 });

    const response = repos.map(repo => ({
      id: repo.id,
      githubRepoId: repo.githubRepoId,
      repoName: repo.repoName,
      repoFullName: repo.repoFullName,
      repoUrl: repo.repoUrl,
      isPrivate: repo.isPrivate,
      autoPostEnabled: repo.autoPostEnabled,
      isWebhookActive: repo.isWebhookActive,
      stats: {
        totalCommits: repo.stats.totalCommits,
        totalPostsGenerated: repo.stats.totalPostsGenerated,
        totalPostsPublished: repo.stats.totalPostsPublished
      }
    }));

    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error("Get repositories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch repositories"
    });
  }
});


// Fetch GitHub repositories
router.get("/repositories/github/list",authMiddleware,async (req, res) => {
    try {
      const userId = req.user.id;

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

      const githubRes = await axios.get(
        "https://api.github.com/user/repos",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json"
          },
          params: {
            per_page: 100,
            sort: "updated"
          }
        }
      );

      const githubRepos = githubRes.data;

      const connectedRepos = await Repository.find({ userId })
        .select("githubRepoId");

      const connectedRepoIds = new Set(
        connectedRepos.map(r => r.githubRepoId)
      );

      const data = githubRepos.map(repo => ({
        id: repo.id.toString(),
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        private: repo.private,
        html_url: repo.html_url,
        isConnected: connectedRepoIds.has(repo.id.toString())
      }));

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      console.error(
        "GitHub repo fetch error:",
        error.response?.data || error
      );

      res.status(500).json({
        success: false,
        message: "Failed to fetch GitHub repositories"
      });
    }
  }
);

// add repository
router.post(
  "/repositories/github/add",
  authMiddleware,
  addRepository
);


// update repository settings
router.patch(
  "/repositories/:repoId",
  authMiddleware,
  updateRepositorySettings
);

// delete repository
router.delete(
  "/repositories/:repoId",
  authMiddleware,
  deleteRepository
);

// get stats for a repository
router.get(
  "/repositories/:repoId/stats",
  authMiddleware,
  getRepositoryStats
);

export default router;
