import express from "express";
import fetch from "node-fetch";
import mysql from "mysql2/promise";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// إعدادات قاعدة البيانات
const db = await mysql.createConnection({
    host: "game1.vndel.com",
    user: "u254_KkTfSGegsD",
    password: "axZP6@WLp+J^SYct9NF6weRx",
    database: "s254_AMSTERDAM",
    port: 3306
});

// إعدادات Discord OAuth2
const DISCORD_CLIENT_ID = "1423445671867977880";
const DISCORD_CLIENT_SECRET = "YcFkRJDx6JR8QgFLp_Y-AyDB6exAa7aV";
const REDIRECT_URI = "http://127.0.0.1:5500/auth/callback.html"; // غيّرها لو عندك موقع حقيقي

// 🔹 تبادل الكود بالـ access_token
app.post("/exchange", async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Missing authorization code" });

    try {
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            return res.status(400).json({ error: "Failed to obtain token", details: tokenData });
        }

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const userData = await userRes.json();
        if (!userData.id) return res.status(400).json({ error: "Failed to fetch user info" });

        await db.query(`
            CREATE TABLE IF NOT EXISTS discord_users (
                id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(100),
                discriminator VARCHAR(10),
                email VARCHAR(150),
                avatar VARCHAR(100)
            )
        `);

        await db.query(
            `INSERT INTO discord_users (id, username, discriminator, email, avatar)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE username=?, discriminator=?, email=?, avatar=?`,
            [
                userData.id,
                userData.username,
                userData.discriminator,
                userData.email || "",
                userData.avatar || "",
                userData.username,
                userData.discriminator,
                userData.email || "",
                userData.avatar || ""
            ]
        );

        res.json({ user: userData, token: tokenData.access_token });
    } catch (error) {
        console.error("❌ OAuth Error:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// فحص الاتصال بقاعدة البيانات
app.get("/status/db", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ status: "connected" });
    } catch (error) {
        res.json({ status: "error", message: error.message });
    }
});

// فحص حالة البوت (يمكن تعديلها لاحقاً)
app.get("/status/discord", async (req, res) => {
    res.json({ status: "online" });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
