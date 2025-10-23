// إعدادات تطبيق Discord
// To avoid hard-coding secrets in JS, set data attributes on the login button like:
// <button id="discord-login-btn" data-client-id="..." data-redirect-uri="https://your.site/auth/callback.html">Login</button>

function getDiscordConfig() {
    // This function returns the last-known config (in-memory) or reads data-attributes.
    const btn = document.getElementById('discord-login-btn');
    const clientId = window.__DISCORD_CONFIG && window.__DISCORD_CONFIG.clientId
        ? window.__DISCORD_CONFIG.clientId
        : (btn ? btn.dataset.clientId : null);
    const redirectUri = window.__DISCORD_CONFIG && window.__DISCORD_CONFIG.redirectUri
        ? window.__DISCORD_CONFIG.redirectUri
        : (btn ? (btn.datasetRedirectUri || btn.dataset.redirectUri) : null);
    return { clientId, redirectUri };
}

// عند الضغط على زر تسجيل الدخول
function loginWithDiscord() {
    const { clientId, redirectUri } = getDiscordConfig();
    if (!clientId || !redirectUri) {
        alert('Discord login not configured.');
        return;
    }
    const scope = 'identify email';
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
    window.location.href = url;
}

// معالجة الكود اللي بيرجع من Discord بعد تسجيل الدخول
async function handleOAuthCallback(code) {
    console.log("📩 Received code:", code);
    try {
        const { redirectUri } = getDiscordConfig();
        const response = await fetch("/exchange", { // relative path to backend
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
        });

        const data = await response.json();
        if (data.error) {
            console.error("❌ OAuth error:", data);
            alert("حدث خطأ أثناء تسجيل الدخول!");
            return;
        }

        console.log("✅ Logged in:", data.user);
    localStorage.setItem("discord_user", JSON.stringify(data.user));
    localStorage.setItem("discord_token", JSON.stringify(data.token));
        window.location.href = "index.html"; // يرجع المستخدم للصفحة الرئيسية
    } catch (e) {
        console.error(e);
    }
}

// عرض الملف الشخصي بعد تسجيل الدخول
document.addEventListener("DOMContentLoaded", async () => {
    const user = localStorage.getItem("discord_user");

    // Try to fetch public config from backend (/config). This keeps secrets on server only.
    try {
        const cfgRes = await fetch('/config');
        if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            // store minimal public config in-memory
            window.__DISCORD_CONFIG = {
                clientId: cfg.discord_client_id || null,
                redirectUri: cfg.discord_redirect_uri || null
            };
        }
    } catch (e) {
        // ignore - fallback to data-attributes
        console.warn('Could not load /config, falling back to data-attributes', e);
    }

    // فحص حالة السيرفر و البوت
    checkSystemStatus();

    if (user) {
        const userData = JSON.parse(user);
        document.getElementById("discord-login-btn").style.display = "none";
        document.getElementById("user-profile").style.display = "block";
        document.getElementById("user-avatar").src = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
        document.getElementById("profile-avatar").src = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
        document.getElementById("profile-username").textContent = userData.username;
        document.getElementById("profile-discriminator").textContent = `#${userData.discriminator}`;
    }
    // Ensure login button works when this file is loaded as a module (no inline onclick)
    try {
        const btn = document.getElementById('discord-login-btn');
        if (btn) {
            // remove any inline onclick to avoid duplicate handlers
            btn.removeAttribute('onclick');
            btn.addEventListener('click', loginWithDiscord);
        }
    } catch (e) {
        // ignore
    }
});

// تسجيل الخروج
function logout() {
    localStorage.removeItem("discord_user");
    localStorage.removeItem("discord_token");
    location.reload();
}

// إظهار / إخفاء القائمة
function toggleProfile() {
    const dropdown = document.getElementById("profile-dropdown");
    const isVisible = dropdown.style.opacity === "1";
    dropdown.style.opacity = isVisible ? "0" : "1";
    dropdown.style.visibility = isVisible ? "hidden" : "visible";
}

// فحص قاعدة البيانات و البوت
async function checkSystemStatus() {
    try {
    const dbRes = await fetch("/status/db");
        const dbData = await dbRes.json();
        document.getElementById("db-value").textContent =
            dbData.status === "connected" ? "✅ متصلة" : "❌ غير متصلة";

    const botRes = await fetch("/status/discord");
        const botData = await botRes.json();
        document.getElementById("discord-value").textContent =
            botData.status === "online" ? "🟢 متصل" : "🔴 غير متصل";
    } catch {
        document.getElementById("db-value").textContent = "❌ خطأ بالاتصال";
        document.getElementById("discord-value").textContent = "❌ خطأ بالاتصال";
    }
}

// لو الكود موجود في رابط الـ callback.html
if (window.location.search.includes("code=")) {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    handleOAuthCallback(code);
}

// Export functions so they are available when this file is imported as a module
export { handleOAuthCallback, loginWithDiscord };
