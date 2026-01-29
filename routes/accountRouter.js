import express from "express";
const router = express.Router();
import ConnectedAccount from "../models/connectedAcoounts.js";
import authMiddleware from "../middleware/authMiddleware.js";

// to get all acoount details
router.get("/accounts", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const accounts = await ConnectedAccount.find({ userId })
            .select(
                "_id platform platformUsername isActive isTokenValid connectedAt"
            )
            .sort({ connectedAt: -1 });

        const formattedAccounts = accounts.map(acc => ({
            id: acc._id,
            platform: acc.platform,
            platformUsername: acc.platformUsername,
            isActive: acc.isActive,
            ...(acc.platform === "linkedin" && {
                isTokenValid: acc.isTokenValid,
            }),
            connectedAt: acc.connectedAt,
        }));

        return res.status(200).json({
            success: true,
            data: formattedAccounts,
        });
    } catch (error) {
        console.error("Error fetching connected accounts:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});

// connect linkedin account
router.get("/accounts/linkedin/connect", authMiddleware, (req, res) => {
    try {
        const state = `${req.user.id}-${Date.now()}`; // optional: store in DB/Redis for CSRF protection
        const params = new URLSearchParams({
            response_type: "code",
            client_id: process.env.LINKEDIN_CLIENT_ID,
            redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
            scope: process.env.LINKEDIN_SCOPE, // e.g. "r_liteprofile r_emailaddress"
            state,
        });

        // 🔁 Direct redirect
        return res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
    } catch (err) {
        console.error("LinkedIn connect error:", err);
        return res.status(500).send("Server error");
    }
});

// 🔹 Step 2: Handle LinkedIn callback
router.get("/accounts/linkedin/callback", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.redirect(`${process.env.FRONTEND_DASHBOARD_URL}?error=oauth_failed`);
        }

        // Extract userId from state
        const userId = state.split("-")[0];

        // Exchange code for access token
        const tokenRes = await axios.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
                client_id: process.env.LINKEDIN_CLIENT_ID,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET,
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token, expires_in } = tokenRes.data;

        // Fetch LinkedIn basic profile
        const profileRes = await axios.get("https://api.linkedin.com/v2/me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        // Fetch LinkedIn email
        const emailRes = await axios.get(
            "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const profile = {
            id: profileRes.data.id,
            firstName: profileRes.data.localizedFirstName,
            lastName: profileRes.data.localizedLastName,
            email: emailRes.data.elements[0]["handle~"].emailAddress,
        };

        // Upsert LinkedIn account
        await ConnectedAccount.findOneAndUpdate(
            { userId, platform: "linkedin" },
            {
                userId,
                platform: "linkedin",
                platformUserId: profile.id,
                platformUsername: `${profile.firstName} ${profile.lastName}`,
                platformEmail: profile.email,
                accessToken: access_token,
                tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
                isActive: true,
                isTokenValid: true,
                connectedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        // 🔁 Redirect back to frontend dashboard
        return res.redirect(process.env.FRONTEND_DASHBOARD_URL);
    } catch (err) {
        console.error("LinkedIn callback error:", err.response?.data || err);
        return res.redirect(`${process.env.FRONTEND_DASHBOARD_URL}?error=linkedin_failed`);
    }
});



export default router;