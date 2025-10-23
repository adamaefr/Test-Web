// إعدادات التطبيق
const BACKEND_URL = "https://your-backend-domain.vercel.app"; // ← لو عندك باك إند، حط رابطه هنا

function getDiscordConfig() {
    const btn = document.getElementById('discord-login-btn');
    const clientId = window.__DISCORD_CONFIG?.clientId || btn?.dataset.clientId;
    const redirectUri = window.__DISCORD_CONFIG?.redirectUri || btn?.dataset.redirectUri;
    return { clientId, redirectUri };
}

// تسجيل الدخول عبر Discord
function loginWithDiscord() {
    const { clientId, redirectUri } = getDiscordConfig();

    if (!clientId || !redirectUri) {
        alert("⚠️ إعدادات Discord غير صحيحة (clientId أو redirectUri ناقص).");
        return;
    }

    const scope = "identify email";
    const discordAuthURL = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    console.log("🔗 OAuth URL:", discordAuthURL);
    window.location.href = discordAuthURL;
}

// معالجة الكود بعد العودة من Discord
async function handleOAuthCallback(code) {
    console.log("📩 Received code:", code);

    try {
        const res = await fetch(`${BACKEND_URL}/auth/discord/callback?code=${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        console.log("✅ Discord callback response:", data);

        if (data.success && data.user) {
            localStorage.setItem("discord_user", JSON.stringify(data.user));
            localStorage.setItem("discord_token", data.token || "");
            window.location.href = "../index.html";
        } else {
            alert("❌ فشل تسجيل الدخول. تأكد من إعداد التطبيق.");
        }
    } catch (err) {
        console.error("❌ OAuth Error:", err);
        alert("حدث خطأ أثناء الاتصال بالسيرفر.");
    }
}

// تنفيذ عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById('discord-login-btn');
    if (btn) btn.addEventListener('click', loginWithDiscord);

    if (window.location.search.includes("code=")) {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        handleOAuthCallback(code);
    }
});
