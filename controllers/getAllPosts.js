import Post from "../models/Posts.js";


export const getAllPosts = async (req, res) => {
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
};
