// إعدادات تطبيق Discord
// مثال زر تسجيل الدخول:
// <button id="discord-login-btn"
//         data-client-id="YOUR_CLIENT_ID"
//         data-redirect-uri="https://yourfrontend.vercel.app/auth/callback.html">
// تسجيل الدخول بـ Discord
// </button>

// 🔗 رابط السيرفر الخلفي (Backend API)
const BACKEND_URL = "https://test-12sz3eopf-adamaefrs-projects.vercel.app"; // ← غيّره حسب رابط السيرفر الفعلي

function getDiscordConfig() {
    const btn = document.getElementById('discord-login-btn');
    const clientId = window.__DISCORD_CONFIG?.clientId || (btn ? btn.dataset.clientId : null);
    const redirectUri = window.__DISCORD_CONFIG?.redirectUri || (btn ? (btn.dataset.redirectUri || btn.datasetRedirectUri) : null);
    return { clientId, redirectUri };
}

// تسجيل الدخول بـ Discord
function loginWithDiscord() {
    const { clientId, redirectUri } = getDiscordConfig();
    if (!clientId || !redirectUri) {
        alert("⚠️ لم يتم ضبط إعدادات Discord بشكل صحيح.");
        return;
    }

    const scope = "identify email";
    const discordAuthURL = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    console.log("🔗 Redirecting to:", discordAuthURL);
    window.location.href = discordAuthURL;
}

// معالجة كود OAuth القادم من Discord
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

            // ✅ بعد نجاح الدخول، يحوّله للصفحة الرئيسية أو الحساب
            window.location.href = "../index.html";
        } else {
            alert("❌ فشل تسجيل الدخول. تأكد من صلاحيات التطبيق.");
        }
    } catch (err) {
        console.error("❌ OAuth Error:", err);
        alert("حدث خطأ أثناء الاتصال بالسيرفر. تأكد من أن السيرفر الخلفي يعمل.");
    }
}

// تحميل بيانات المستخدم بعد الدخول
document.addEventListener("DOMContentLoaded", async () => {
    // تحميل إعدادات عامة من السيرفر (اختياري)
    try {
        const cfgRes = await fetch(`${BACKEND_URL}/config`);
        if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            window.__DISCORD_CONFIG = {
                clientId: cfg.discord_client_id || null,
                redirectUri: cfg.discord_redirect_uri || null
            };
        }
    } catch {
        console.warn("⚠️ تعذر تحميل إعدادات /config من السيرفر.");
    }

    const user = localStorage.getItem("discord_user");

    if (user) {
        const u = JSON.parse(user);
        const btn = document.getElementById("discord-login-btn");
        const profile = document.getElementById("user-profile");

        if (btn) btn.style.display = "none";
        if (profile) {
            profile.style.display = "block";
            document.getElementById("user-avatar").src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
            document.getElementById("profile-avatar").src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
            document.getElementById("profile-username").textContent = u.username;
            document.getElementById("profile-discriminator").textContent = `#${u.discriminator}`;
        }
    }

    // تفعيل زر تسجيل الدخول
    const btn = document.getElementById('discord-login-btn');
    if (btn) {
        btn.removeAttribute('onclick');
        btn.addEventListener('click', loginWithDiscord);
    }

    // فحص حالة النظام
    checkSystemStatus();
});

// تسجيل الخروج
function logout() {
    localStorage.removeItem("discord_user");
    localStorage.removeItem("discord_token");
    location.reload();
}

// فحص حالة السيرفر والبوت
async function checkSystemStatus() {
    try {
        const dbRes = await fetch(`${BACKEND_URL}/status/db`);
        const dbData = await dbRes.json();
        document.getElementById("db-value").textContent =
            dbData.status === "connected" ? "✅ متصلة" : "❌ غير متصلة";

        const botRes = await fetch(`${BACKEND_URL}/status/discord`);
        const botData = await botRes.json();
        document.getElementById("discord-value").textContent =
            botData.status === "online" ? "🟢 متصل" : "🔴 غير متصل";
    } catch (e) {
        console.error("⚠️ Status check failed:", e);
        document.getElementById("db-value").textContent = "❌ خطأ بالاتصال";
        document.getElementById("discord-value").textContent = "❌ خطأ بالاتصال";
    }
}

// لو الكود موجود في عنوان الصفحة (callback.html)
if (window.location.search.includes("code=")) {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    handleOAuthCallback(code);
}

export { handleOAuthCallback, loginWithDiscord };
