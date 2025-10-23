// Simple Discord bot that replies to !status with backend status info
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = require('node-fetch');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000';

if (!TOKEN) {
  console.error('DISCORD_BOT_TOKEN is not set in environment. Exiting.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
  console.log(`Bot ready as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  if (content === '!status') {
    try {
      const [dbRes, discordRes, pingRes] = await Promise.all([
        fetch(`${BACKEND}/status/db`).then(r => r.json()),
        fetch(`${BACKEND}/status/discord`).then(r => r.json()),
        fetch(`${BACKEND}/api/ping`).then(r => r.json()).catch(() => null)
      ]);

      const dbStatus = dbRes && dbRes.status === 'connected' ? '✅ قاعدة البيانات متصلة' : '❌ قاعدة البيانات غير متصلة';
      const discordStatus = discordRes && discordRes.status === 'online' ? '🟢 البوت متصل' : `🔴 البوت: ${discordRes && discordRes.status ? discordRes.status : 'خطأ'}`;
      const pong = pingRes && pingRes.ok ? '🔁 backend responsive' : '⚠️ backend no response';

      await message.reply(`${dbStatus}\n${discordStatus}\n${pong}`);
    } catch (e) {
      console.error('Error fetching status:', e);
      await message.reply('حدث خطأ أثناء جلب الحالة من الخادم.');
    }
  }
});

client.login(TOKEN).catch(err => {
  console.error('Failed to login bot:', err);
  process.exit(1);
});
