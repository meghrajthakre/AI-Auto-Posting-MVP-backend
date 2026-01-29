import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
    // Primary identifier
    id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString(),
        unique: true,
        index: true
    },

    // Authentication
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: 'Invalid email format'
        }
    },

    password: {
        type: String,
        required: function () {
            return !this.githubId; // Required only if not using OAuth
        },
        minlength: 8,
        select: false // Never return in queries by default
    },

    // OAuth Integration
    githubId: {
        type: String,
        unique: true,
        sparse: true, // Allow null values while keeping unique constraint
        index: true
    },

    githubUsername: {
        type: String,
        sparse: true
    },

    // Profile Information
    name: {
        type: String,
        trim: true
    },

    avatar: {
        type: String, // URL to avatar image
        default: null
    },

    // User Preferences
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: false }
        },
        autoPostSettings: {
            requireApproval: { type: Boolean, default: true },
            platforms: {
                linkedin: { type: Boolean, default: true },
                x: { type: Boolean, default: true }
            }
        },
        aiSettings: {
            tone: {
                type: String,
                enum: ['professional', 'casual', 'technical', 'friendly'],
                default: 'professional'
            },
            includeCodeSnippets: { type: Boolean, default: false },
            includeHashtags: { type: Boolean, default: true }
        }
    },


}, {
    timestamps: true, // Automatically manages createdAt and updatedAt
    collection: 'users'
});



// Pre-save hook to hash password
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};
// Method to get public profile (exclude sensitive data)
userSchema.methods.toPublicJSON = function () {
    return {
        id: this.id,
        email: this.email,
        name: this.name,
        avatar: this.avatar,
        githubUsername: this.githubUsername,
        plan: this.plan,
        createdAt: this.createdAt
    };
};

userSchema.methods.generateAuthToken = function () {
    const token = jwt.sign(
        { id: this._id, email: this.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    return token;
};

const User = mongoose.model("User", userSchema);
export default User;