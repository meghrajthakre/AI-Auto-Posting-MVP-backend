import express from "express";
import { getAllPosts } from "../controllers/getAllPosts.js";
import authMiddleware from "../middleware/authMiddleware.js";
import Post from "../models/postsSchema.js";
const router = express.Router();

// get all posts 
router.get("/posts", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      status,
      platform,
      repositoryId,
      limit = 20,
      page = 1
    } = req.query;

    // 1️⃣ Build query
    const query = { userId };

    if (status) query.status = status;
    if (platform) query.platform = platform;
    if (repositoryId) query.repositoryId = repositoryId;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;

    // 2️⃣ Fetch posts
    const [posts, totalPosts] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .skip(skip)
        .populate("repositoryId", "id repoName repoFullName")
        .lean(),

      Post.countDocuments(query)
    ]);

    // 3️⃣ Shape response
    const formattedPosts = posts.map(post => ({
      id: post.id,
      platform: post.platform,
      content: post.content,
      status: post.status,
      commitMessage: post.commitMessage,
      commitHash: post.commitHash,
      commitUrl: post.commitUrl,
      repository: post.repositoryId
        ? {
          id: post.repositoryId.id,
          name: post.repositoryId.repoName
        }
        : null,
      createdAt: post.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        posts: formattedPosts,
        pagination: {
          currentPage: parsedPage,
          totalPages: Math.ceil(totalPosts / parsedLimit),
          totalPosts,
          limit: parsedLimit
        }
      }
    });

  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch posts"
    });
  }

});

// get post by id
router.get("/posts/:id", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id; // assuming authMiddleware sets req.user

    // Fetch post by ID and userId for security
    const post = await Post.findOne({ id: postId, userId }).lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Shape response similar to your API docs
    const formattedPost = {
      id: post.id,
      platform: post.platform,
      content: post.content,
      originalContent: post.originalContent,
      status: post.status,
      commitHash: post.commitHash,
      commitMessage: post.commitMessage,
      commitAuthor: post.commitAuthor,
      filesChanged: post.filesChanged,
      aiMetadata: post.aiMetadata,
      createdAt: post.createdAt
    };

    res.status(200).json({
      success: true,
      data: formattedPost
    });

  } catch (error) {
    console.error("Get single post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch post"
    });
  }
});

router.post("/posts/:postId/approve", authMiddleware, async (req, res) => {

    try {
    const { postId } = req.params;
    const { content } = req.body;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Post cannot be approved. Current status: ${post.status}`,
      });
    }

    // Optional content edit before approval
    if (content && content.trim()) {
      post.content = content;
    }

    post.status = "APPROVED";
    post.approvedAt = new Date();

    await post.save();

    // 🔁 Optional: push to queue / cron / worker
    // await publishQueue.add({ postId: post._id });

    return res.status(200).json({
      success: true,
      data: {
        id: post._id,
        status: post.status,
        approvedAt: post.approvedAt,
      },
      message: "Post approved and queued for publishing",
    });
  } catch (error) {
    console.error("Approve post error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

});
export default router;