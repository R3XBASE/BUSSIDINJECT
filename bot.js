const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const express = require('express');
const http = require('http');

// Inisialisasi Express
const app = express();
const server = http.createServer(app);

// Konfigurasi PostgreSQL dari environment variables untuk Neon
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware Express untuk health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Server HTTP untuk Koyeb
server.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});

// Fungsi PlayFab Login
async function loginWithDevice(deviceId) {
  try {
    const url = 'https://4ae9.playfabapi.com/Client/LoginWithAndroidDeviceID?sdk=UnitySDK-2.135.220509';
    const payload = {
      AndroidDevice: 'AndroidPhone',
      AndroidDeviceId: deviceId,
      CreateAccount: true,
      TitleId: '4AE9'
    };
    const headers = {
      'User-Agent': 'UnityPlayer/2021.3.40f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)',
      'Accept-Encoding': 'deflate, gzip',
      'Content-Type': 'application/json',
      'X-ReportErrorAsSuccess': 'true',
      'X-PlayFabSDK': 'UnitySDK-2.135.220509',
      'X-Unity-Version': '2021.3.40f1'
    };
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await response.json();
    return data.data?.SessionTicket || null;
  } catch (error) {
    console.error('LoginWithDevice error:', error);
    return null;
  }
}

// Fungsi PlayFab Add RP
async function addRp(xAuth, value) {
  try {
    const url = 'https://4ae9.playfabapi.com/Client/ExecuteCloudScript?sdk=UnitySDK-2.135.220509';
    const payload = {
      FunctionName: 'AddRp',
      FunctionParameter: { addValue: value },
      GeneratePlayStreamEvent: false,
      RevisionSelection: 'Live'
    };
    const headers = {
      'User-Agent': 'UnityPlayer/2021.3.40f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)',
      'Accept-Encoding': 'deflate, gzip',
      'Content-Type': 'application/json',
      'X-ReportErrorAsSuccess': 'true',
      'X-PlayFabSDK': 'UnitySDK-2.135.220509',
      'X-Authorization': xAuth,
      'X-Unity-Version': '2021.3.40f1'
    };
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    return await response.json();
  } catch (error) {
    console.error('AddRp error:', error);
    return { error: 'Failed to add RP' };
  }
}

// Cek apakah pengguna terdaftar dan disetujui
async function isUserRegisteredAndApproved(telegramId) {
  try {
    const result = await pool.query('SELECT device_id, approved FROM users WHERE telegram_id = $1', [telegramId]);
    const user = result.rows[0];
    return user ? { registered: true, approved: user.approved, deviceId: user.device_id } : { registered: false, approved: false, deviceId: null };
  } catch (error) {
    console.error('Database error:', error);
    return { registered: false, approved: false, deviceId: null };
  }
}

// Daftarkan Device ID
async function registerDevice(telegramId, deviceId) {
  try {
    await pool.query('INSERT INTO users (telegram_id, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [telegramId, deviceId]);
  } catch (error) {
    console.error('Database error:', error);
  }
}

// Command /start
bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const userInfo = await isUserRegisteredAndApproved(telegramId);

  if (!userInfo.registered) {
    return ctx.reply('Masukkan Device ID Anda terlebih dahulu:');
  }

  if (!userInfo.approved) {
    return ctx.reply('Device ID Anda belum disetujui oleh admin. Silakan tunggu.');
  }

  const inlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Inject 5 Juta', 'inject_5000000')],
    [Markup.button.callback('Inject 10 Juta', 'inject_10000000')],
    [Markup.button.callback('Inject 20 Juta', 'inject_20000000')],
    [Markup.button.callback('Inject 50 Juta', 'inject_50000000')],
    [Markup.button.callback('Inject 100 Juta', 'inject_100000000')],
    [Markup.button.callback('Inject 200 Juta', 'inject_200000000')],
    [Markup.button.callback('Inject 500 Juta', 'inject_500000000')],
    [Markup.button.callback('Sedot UB (-2.179.683.487)', 'sedot_-2179683487')]
  ]);

  ctx.reply('Pilih opsi inject atau sedot UB:', inlineKeyboard);
});

// Tangani callback query dari inline keyboard
bot.action(/inject_(\d+)/, async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const value = parseInt(ctx.match[1]);
  await handleInject(ctx, telegramId, value);
});

bot.action('sedot_-2179683487', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  await handleInject(ctx, telegramId, -2179683487); // Nilai negatif untuk sedot UB
});

// Fungsi handler untuk inject
async function handleInject(ctx, telegramId, value) {
  const userInfo = await isUserRegisteredAndApproved(telegramId);

  if (!userInfo.registered) {
    return ctx.answerCbQuery('Pengguna tidak terdaftar!');
  }

  if (!userInfo.approved) {
    return ctx.answerCbQuery('Pengguna belum disetujui!');
  }

  const deviceId = userInfo.deviceId;
  if (!deviceId) {
    return ctx.answerCbQuery('Device ID tidak ditemukan!');
  }

  try {
    const sessionTicket = await loginWithDevice(deviceId);
    if (sessionTicket) {
      const result = await addRp(sessionTicket, value);
      if (result.error) {
        ctx.answerCbQuery(`Gagal ${value < 0 ? 'sedot' : 'inject'} UB: ${result.error}`);
      } else {
        const action = value < 0 ? 'Sedot' : 'Inject';
        const absValue = Math.abs(value).toLocaleString();
        ctx.answerCbQuery(`${action} ${absValue} UB berhasil!`);
        ctx.reply(`${action} ${absValue} UB: ${JSON.stringify(result, null, 2)}`);
      }
    } else {
      ctx.answerCbQuery('Gagal login dengan Device ID Anda.');
    }
  } catch (error) {
    console.error('Inject error:', error);
    ctx.answerCbQuery(`Terjadi kesalahan saat ${value < 0 ? 'sedot' : 'inject'} UB!`);
  }
}

// Tangani pesan teks manual (opsional, jika ingin input custom)
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  const userInfo = await isUserRegisteredAndApproved(telegramId);

  if (!userInfo.registered) {
    await registerDevice(telegramId, text);
    return ctx.reply('Device ID Anda telah dikirim untuk persetujuan admin. Tunggu hingga disetujui.');
  }

  if (!userInfo.approved) {
    return ctx.reply('Device ID Anda belum disetujui oleh admin. Silakan tunggu.');
  }

  if (text === 'Inject UB') {
    const inlineKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Inject 5 Juta', 'inject_5000000')],
      [Markup.button.callback('Inject 10 Juta', 'inject_10000000')],
      [Markup.button.callback('Inject 20 Juta', 'inject_20000000')],
      [Markup.button.callback('Inject 50 Juta', 'inject_50000000')],
      [Markup.button.callback('Inject 100 Juta', 'inject_100000000')],
      [Markup.button.callback('Inject 200 Juta', 'inject_200000000')],
      [Markup.button.callback('Inject 500 Juta', 'inject_500000000')],
      [Markup.button.callback('Sedot UB (-2.179.683.487)', 'sedot_-2179683487')]
    ]);
    return ctx.reply('Pilih jumlah UB:', inlineKeyboard);
  } else if (text === 'Cek Status') {
    ctx.reply('Fitur ini belum diimplementasikan.');
  } else if (text === 'Bantuan') {
    ctx.reply('Gunakan menu untuk navigasi. Hubungi admin jika ada masalah.');
  }
});

// Jalankan bot
bot.launch().then(() => {
  console.log('Bot berjalan...');
}).catch((err) => {
  console.error('Bot gagal berjalan:', err);
});

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  pool.end(() => process.exit(0));
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  pool.end(() => process.exit(0));
});

// Tutup pool saat aplikasi berhenti
process.on('exit', () => pool.end());
