import Repository from "../models/repository.js";

export const getRepositoryStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { repoId } = req.params;

    // 1️⃣ Find repository owned by user
    const repo = await Repository.findOne({
      id: repoId,
      userId
    });

    if (!repo) {
      return res.status(404).json({
        success: false,
        message: "Repository not found"
      });
    }

    // 2️⃣ Send stats only
    res.status(200).json({
      success: true,
      data: {
        totalCommits: repo.stats.totalCommits,
        totalPostsGenerated: repo.stats.totalPostsGenerated,
        totalPostsPublished: repo.stats.totalPostsPublished,
        lastCommitAt: repo.stats.lastCommitAt,
        lastPostGeneratedAt: repo.stats.lastPostGeneratedAt
      }
    });

  } catch (error) {
    console.error("Get repository stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch repository stats"
    });
  }
};
