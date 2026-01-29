import mongoose from 'mongoose';

const connectedAccountSchema = new mongoose.Schema({
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
  
  // Platform Details
  platform: {
    type: String,
    required: true,
    enum: ['github', 'linkedin', 'x', 'twitter'], // twitter for backward compatibility
    index: true
  },
  
  // OAuth Tokens (ENCRYPTED)
  accessToken: {
    type: String,
    required: true,
    select: false // Never return in queries by default
  },
  
  refreshToken: {
    type: String,
    select: false
  },
  
  tokenExpiresAt: {
    type: Date,
    required: false
  },
  
  // Platform-specific User Info
  platformUserId: {
    type: String,
    required: true
  },
  
  platformUsername: {
    type: String
  },
  
  platformEmail: {
    type: String
  },
  
  profileUrl: {
    type: String
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isTokenValid: {
    type: Boolean,
    default: true
  },
  
  lastTokenRefresh: {
    type: Date
  },
  
  // Permissions/Scopes granted
  scopes: [{
    type: String
  }],
  
  // Timestamps
  connectedAt: {
    type: Date,
    default: Date.now
  },
  
  lastUsedAt: {
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
  collection: 'connected_accounts'
});

// Compound index for userId + platform (one account per platform per user)
connectedAccountSchema.index({ userId: 1, platform: 1 }, { unique: true });
connectedAccountSchema.index({ platformUserId: 1, platform: 1 });

// Method to check if token is expired
connectedAccountSchema.methods.isTokenExpired = function() {
  if (!this.tokenExpiresAt) return false;
  return this.tokenExpiresAt < new Date();
};

// Method to encrypt tokens (use this before saving)
connectedAccountSchema.methods.encryptTokens = function(accessToken, refreshToken) {
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
  
  // Encrypt access token
  const accessIv = crypto.randomBytes(16);
  const accessCipher = crypto.createCipheriv(algorithm, key, accessIv);
  let encryptedAccess = accessCipher.update(accessToken, 'utf8', 'hex');
  encryptedAccess += accessCipher.final('hex');
  const accessAuthTag = accessCipher.getAuthTag();
  
  this.accessToken = `${accessIv.toString('hex')}:${accessAuthTag.toString('hex')}:${encryptedAccess}`;
  
  // Encrypt refresh token if provided
  if (refreshToken) {
    const refreshIv = crypto.randomBytes(16);
    const refreshCipher = crypto.createCipheriv(algorithm, key, refreshIv);
    let encryptedRefresh = refreshCipher.update(refreshToken, 'utf8', 'hex');
    encryptedRefresh += refreshCipher.final('hex');
    const refreshAuthTag = refreshCipher.getAuthTag();
    
    this.refreshToken = `${refreshIv.toString('hex')}:${refreshAuthTag.toString('hex')}:${encryptedRefresh}`;
  }
};

// Method to decrypt tokens (use when needed)
connectedAccountSchema.methods.decryptToken = function(tokenType = 'access') {
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  const encryptedToken = tokenType === 'access' ? this.accessToken : this.refreshToken;
  if (!encryptedToken) return null;
  
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Method to get public data (exclude tokens)
connectedAccountSchema.methods.toPublicJSON = function() {
  return {
    id: this.id,
    platform: this.platform,
    platformUsername: this.platformUsername,
    isActive: this.isActive,
    isTokenValid: this.isTokenValid,
    connectedAt: this.connectedAt,
    lastUsedAt: this.lastUsedAt
  };
};

const ConnectedAccount = mongoose.model('ConnectedAccount', connectedAccountSchema);

export default ConnectedAccount;