import mongoose from 'mongoose';
import crypto from 'crypto';
const repositorySchema = new mongoose.Schema({
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
  
  // Repository Details
  githubRepoId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  repoName: {
    type: String,
    required: true
  },
  
  repoFullName: {
    type: String, // e.g., "username/repo-name"
    required: true
  },
  
  repoUrl: {
    type: String,
    required: true
  },
  
  repoDescription: {
    type: String
  },
  
  repoLanguage: {
    type: String // Primary language (e.g., "JavaScript", "Python")
  },
  
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  // Webhook Configuration
  webhookId: {
    type: String, // GitHub webhook ID
    index: true
  },
  
  webhookSecret: {
    type: String,
    select: false // Keep webhook secret secure
  },
  
  webhookUrl: {
    type: String
  },
  
  isWebhookActive: {
    type: Boolean,
    default: false
  },
  
  // Auto-post Settings
  autoPostEnabled: {
    type: Boolean,
    default: true
  },
  
  postGenerationSettings: {
    triggerEvents: [{
      type: String,
      enum: ['push', 'pull_request', 'release', 'issues'],
      default: 'push'
    }],
    
    minCommitsForPost: {
      type: Number,
      default: 1 // Generate post after X commits
    },
    
    platforms: {
      linkedin: { type: Boolean, default: true },
      x: { type: Boolean, default: true }
    },
    
    postFrequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'immediate'
    }
  },
  
  // Statistics
  stats: {
    totalCommits: { type: Number, default: 0 },
    totalPostsGenerated: { type: Number, default: 0 },
    totalPostsPublished: { type: Number, default: 0 },
    lastCommitAt: { type: Date },
    lastPostGeneratedAt: { type: Date }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  connectedAt: {
    type: Date,
    default: Date.now
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'repositories'
});

// Indexes
repositorySchema.index({ userId: 1, repoFullName: 1 }, { unique: true });
repositorySchema.index({ webhookId: 1 });

// Method to increment commit count
repositorySchema.methods.incrementCommitCount = async function() {
  this.stats.totalCommits += 1;
  this.stats.lastCommitAt = new Date();
  await this.save();
};

// Method to increment post counts
repositorySchema.methods.incrementPostCounts = async function(wasPublished = false) {
  this.stats.totalPostsGenerated += 1;
  this.stats.lastPostGeneratedAt = new Date();
  
  if (wasPublished) {
    this.stats.totalPostsPublished += 1;
  }
  
  await this.save();
};

// Method to check if auto-posting is enabled for a platform
repositorySchema.methods.isAutoPostEnabledFor = function(platform) {
  return this.autoPostEnabled && 
         this.postGenerationSettings.platforms[platform] === true;
};

// Method to generate webhook secret
repositorySchema.methods.generateWebhookSecret = function() {
  
  this.webhookSecret = crypto.randomBytes(32).toString('hex');
  return this.webhookSecret;
};

// Method to verify webhook signature
repositorySchema.methods.verifyWebhookSignature = function(payload, signature) {
  
  const hmac = crypto.createHmac('sha256', this.webhookSecret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
};

// Method to get public data
repositorySchema.methods.toPublicJSON = function() {
  return {
    id: this.id,
    repoName: this.repoName,
    repoFullName: this.repoFullName,
    repoUrl: this.repoUrl,
    repoDescription: this.repoDescription,
    repoLanguage: this.repoLanguage,
    isPrivate: this.isPrivate,
    autoPostEnabled: this.autoPostEnabled,
    isWebhookActive: this.isWebhookActive,
    postGenerationSettings: this.postGenerationSettings,
    stats: this.stats,
    connectedAt: this.connectedAt
  };
};

export default mongoose.model("Repository", repositorySchema);