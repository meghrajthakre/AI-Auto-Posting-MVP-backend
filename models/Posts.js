
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString(),
        unique: true
    },

    userId: {
        type: String,
        required: true,
        ref: 'User',
        index: true
    },

    repositoryId: {
        type: String,
        required: true,
        ref: 'Repository',
        index: true
    },

    // Platform
    platform: {
        type: String,
        required: true,
        enum: ['linkedin', 'x', 'twitter'], // twitter for backward compatibility
        index: true
    },

    // Post Content
    content: {
        type: String,
        required: true,
        maxlength: 3000 // LinkedIn limit is 3000 characters
    },

    originalContent: {
        type: String, // Store original AI-generated content before user edits
        required: true
    },

    // Git Commit Information
    commitHash: {
        type: String,
        required: true,
        index: true
    },

    commitMessage: {
        type: String,
        required: true
    },

    commitAuthor: {
        name: String,
        email: String,
        username: String
    },

    commitUrl: {
        type: String
    },

    commitTimestamp: {
        type: Date
    },

    // Files changed in the commit
    filesChanged: [{
        filename: String,
        additions: Number,
        deletions: Number,
        changes: Number,
        status: String // 'added', 'modified', 'removed'
    }],

    commitStats: {
        totalAdditions: { type: Number, default: 0 },
        totalDeletions: { type: Number, default: 0 },
        filesChangedCount: { type: Number, default: 0 }
    },

    // Post Status
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'POSTED', 'FAILED', 'SCHEDULED'],
        default: 'PENDING',
        index: true
    },

    // Publishing Details
    publishedAt: {
        type: Date,
        index: true
    },

    scheduledFor: {
        type: Date,
        index: true
    },

    platformPostId: {
        type: String, // The ID from LinkedIn/X after posting
        index: true
    },

    platformPostUrl: {
        type: String // Direct link to the post
    },

    // User Actions
    approvedBy: {
        type: String,
        ref: 'User'
    },

    approvedAt: {
        type: Date
    },

    rejectedAt: {
        type: Date
    },

    rejectionReason: {
        type: String
    },

    // Edit History
    editHistory: [{
        editedAt: { type: Date, default: Date.now },
        previousContent: String,
        editedBy: String // userId
    }],

    wasEdited: {
        type: Boolean,
        default: false
    },

    // AI Generation Metadata
    aiMetadata: {
        model: String, // e.g., "gpt-4", "claude-3"
        provider: String, // e.g., "openai", "groq", "anthropic"
        generatedAt: { type: Date, default: Date.now },
        tokensUsed: Number,
        generationTimeMs: Number,
        temperature: Number,
        prompt: String // Store the prompt used for regeneration
    },

    // Engagement Metrics (for future analytics)
    metrics: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        lastFetchedAt: { type: Date }
    },

    // Error Tracking
    error: {
        message: String,
        code: String,
        occurredAt: Date
    },

    retryCount: {
        type: Number,
        default: 0
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'posts'
});

// Indexes for common queries
postSchema.index({ userId: 1, status: 1 });
postSchema.index({ repositoryId: 1, createdAt: -1 });
postSchema.index({ commitHash: 1, platform: 1 });
postSchema.index({ status: 1, scheduledFor: 1 });
postSchema.index({ createdAt: -1 });

// Method to approve post
postSchema.methods.approve = async function (userId, editedContent = null) {
    this.status = 'APPROVED';
    this.approvedBy = userId;
    this.approvedAt = new Date();

    if (editedContent && editedContent !== this.content) {
        this.editHistory.push({
            editedAt: new Date(),
            previousContent: this.content,
            editedBy: userId
        });
        this.content = editedContent;
        this.wasEdited = true;
    }

    await this.save();
    return this;
};

// Method to reject post
postSchema.methods.reject = async function (reason = null) {
    this.status = 'REJECTED';
    this.rejectedAt = new Date();
    if (reason) this.rejectionReason = reason;

    await this.save();
    return this;
};

// Method to mark as published
postSchema.methods.markAsPublished = async function (platformPostId, platformPostUrl) {
    this.status = 'POSTED';
    this.publishedAt = new Date();
    this.platformPostId = platformPostId;
    this.platformPostUrl = platformPostUrl;

    await this.save();
    return this;
};

// Method to mark as failed
postSchema.methods.markAsFailed = async function (errorMessage, errorCode = null) {
    this.status = 'FAILED';
    this.error = {
        message: errorMessage,
        code: errorCode,
        occurredAt: new Date()
    };
    this.retryCount += 1;

    await this.save();
    return this;
};

// Method to update content (with history)
postSchema.methods.updateContent = async function (newContent, userId) {
    if (this.content !== newContent) {
        this.editHistory.push({
            editedAt: new Date(),
            previousContent: this.content,
            editedBy: userId
        });
        this.content = newContent;
        this.wasEdited = true;
        await this.save();
    }
    return this;
};

// Method to check if post can be edited
postSchema.methods.canBeEdited = function () {
    return ['PENDING', 'APPROVED', 'FAILED'].includes(this.status);
};

// Method to check if post can be approved
postSchema.methods.canBeApproved = function () {
    return this.status === 'PENDING';
};

// Method to check if post can be published
postSchema.methods.canBePublished = function () {
    return this.status === 'APPROVED';
};

// Method to get public data
postSchema.methods.toPublicJSON = function () {
    return {
        id: this.id,
        platform: this.platform,
        content: this.content,
        status: this.status,
        commitMessage: this.commitMessage,
        commitHash: this.commitHash,
        commitUrl: this.commitUrl,
        commitAuthor: this.commitAuthor,
        filesChanged: this.filesChanged,
        commitStats: this.commitStats,
        wasEdited: this.wasEdited,
        publishedAt: this.publishedAt,
        platformPostUrl: this.platformPostUrl,
        metrics: this.metrics,
        createdAt: this.createdAt
    };
};

// Static method to get posts by status
postSchema.statics.getByStatus = function (userId, status, limit = 20, skip = 0) {
    return this.find({ userId, status })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('repositoryId', 'repoName repoFullName');
};

// Static method to get pending posts
postSchema.statics.getPendingPosts = function (userId) {
    return this.find({ userId, status: 'PENDING' })
        .sort({ createdAt: -1 })
        .populate('repositoryId', 'repoName repoFullName');
};

const Post = mongoose.model('Post', postSchema);
export default Post;