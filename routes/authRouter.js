import express from "express";
import bcrypt from "bcrypt";
const router = express.Router();
import User from "../models/User.js";

// Helper function for email validation
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long"
      });
    }

    if (name && name.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 3 characters long"
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Create user
    const newUser = new User({
      name: name || "",
      email: email.toLowerCase(),
      password
    });

    const savedUser = await newUser.save();
    const token = savedUser.generateAuthToken();

    // Optional: cookie (frontend SSR ke liye)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // ✅ Document-style response
    res.status(201).json({
      success: true,
      data: {
        userId: savedUser._id,
        email: savedUser.email,
        token
      }
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during signup"
    });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    console.log("Login attempt for email:", email);
    const user = await User
      .findOne({ email: email.toLowerCase() })
      .select("+password");
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    console.log("Password match:", isMatch);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = user.generateAuthToken();

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: "Login successful",
      user: user.toPublicJSON()
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});



// github OAuth routes will go here

router.get("/github", (req, res) => {
  const githubAuthURL =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&redirect_uri=${process.env.GITHUB_CALLBACK_URL}` +
    `&scope=user:email`;

  res.redirect(githubAuthURL); // 302 redirect
});
import axios from "axios";

router.get("/github/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect("/login?error=oauth_failed");
    }

    // 1️⃣ Exchange code → access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenRes.data.access_token;

    // 2️⃣ Get GitHub user
    const { data: githubUser } = await axios.get(
      "https://api.github.com/user",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    // 3️⃣ Get verified primary email
    const { data: emails } = await axios.get(
      "https://api.github.com/user/emails",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const primaryEmail = emails.find(
      e => e.primary && e.verified
    )?.email;

    if (!primaryEmail) {
      return res.redirect("/login?error=email_not_found");
    }

    // 4️⃣ Find user by GitHub ID FIRST
    let user = await User.findOne({
      githubId: githubUser.id.toString()
    });

    if (!user) {
      // 5️⃣ Check if email already exists
      user = await User.findOne({ email: primaryEmail });

      if (user) {
        // 🔗 Link GitHub account to existing user
        user.githubId = githubUser.id.toString();
        user.githubUsername = githubUser.login;
        user.avatar = githubUser.avatar_url;
        await user.save();
      } else {
        // 🆕 Create new OAuth user
        user = await User.create({
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          githubId: githubUser.id.toString(),  
          githubUsername: githubUser.login,
          avatar: githubUser.avatar_url
        });
      }
    }

    // 6️⃣ Generate JWT
    const token = user.generateAuthToken();

    // 7️⃣ Optional cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // 8️⃣ Redirect to frontend
    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?token=${token}`
    );

  } catch (error) {
    console.error("GitHub OAuth Error:", error);
    res.redirect("/login?error=github_auth_failed");
  }
});




export default router;