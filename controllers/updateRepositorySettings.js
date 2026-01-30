import Repository from "../models/repository.js";

export const updateRepositorySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { repoId } = req.params;
    const updates = req.body;

    // 1️⃣ Find repo owned by user
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

    // 2️⃣ Update allowed fields only
    if (typeof updates.autoPostEnabled === "boolean") {
      repo.autoPostEnabled = updates.autoPostEnabled;
    }

    if (updates.postGenerationSettings) {
      repo.postGenerationSettings = {
        ...repo.postGenerationSettings.toObject(),
        ...updates.postGenerationSettings,
        platforms: {
          ...repo.postGenerationSettings.platforms,
          ...updates.postGenerationSettings.platforms
        }
      };
    }

    repo.updatedAt = new Date();
    await repo.save();

    // 3️⃣ Send clean response
    res.status(200).json({
      success: true,
      data: {
        id: repo.id,
        autoPostEnabled: repo.autoPostEnabled,
        postGenerationSettings: repo.postGenerationSettings
      }
    });

  } catch (error) {
    console.error("Update repository error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update repository settings"
    });
  }
};
