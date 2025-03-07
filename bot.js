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

// Start Command /bussid
bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const userInfo = await isUserRegisteredAndApproved(telegramId);

  if (!userInfo.registered) {
    return ctx.reply('ᗰᗩՏᑌKKᗩᑎ ᗪᗴᐯIᑕᗴ ᗩᑎᗪᗩ');
  }

  if (!userInfo.approved) {
    return ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ ᗷᗴᒪᑌᗰ ᗪI ՏᗴTᑌᒍᑌI ᗰOᕼOᑎ Tᑌᑎᘜᘜᑌ');
  }

  const inlineKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 5 𝘑𝘜𝘛𝘈', 'inject_5000000'),
      Markup.button.callback('💎 10 𝘑𝘜𝘛𝘈', 'inject_10000000')
    ],
    [
      Markup.button.callback('🌟 20 𝘑𝘜𝘛𝘈', 'inject_20000000'),
      Markup.button.callback('🔥 50 𝘑𝘜𝘛𝘈', 'inject_50000000')
    ],
    [
      Markup.button.callback('💸 100 𝘑𝘜𝘛𝘈', 'inject_100000000'),
      Markup.button.callback('💵 200 𝘑𝘜𝘛𝘈', 'inject_200000000')
    ],
    [
      Markup.button.callback('💲 500 𝘑𝘜𝘛𝘈', 'inject_500000000'),
      Markup.button.callback('⬇️ 𝘚𝘌𝘋𝘖𝘛 𝘜𝘉 (-2𝘔)', 'sedot_-2179683487')
    ]
  ]);

  ctx.reply('🎮 ᑭIᒪIᕼ OᑭՏI IᑎᒍᗴᑕT ᗩTᗩᑌ ՏᗴᗪOT 🎮', inlineKeyboard);
});

// Tangani callback query dari inline keyboard
bot.action(/inject_(\d+)/, async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const value = parseInt(ctx.match[1]);
  await handleInject(ctx, telegramId, value);
});

bot.action('sedot_-2179683487', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  await handleInject(ctx, telegramId, -2179683487);
});

// Fungsi handler untuk inject
async function handleInject(ctx, telegramId, value) {
  const userInfo = await isUserRegisteredAndApproved(telegramId);

  if (!userInfo.registered) {
    return ctx.answerCbQuery('ᗩᑎᗪᗩ ᗷᗴᒪᑌᗰ TᗴᖇᗪᗩᖴTᗩᖇ');
  }

  if (!userInfo.approved) {
    return ctx.answerCbQuery('ᗩᑎᗪᗩ ᗷᗴᒪᑌᗰ ᗪIՏᗴTᑌᒍᑌI');
  }

  const deviceId = userInfo.deviceId;
  if (!deviceId) {
    return ctx.answerCbQuery('ᗪᗴᐯIᑕᗴ Iᗪ TIᗪᗩK ᗪITᗴᗰᑌKᗩᑎ');
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
        ctx.answerCbQuery(`${action} ${absValue} ᑌᗷ ᗷᗴᖇᕼᗩՏIᒪ!`);
        ctx.reply(`${action} ${absValue} ՏᑌKՏᗴՏ ᗯᗩK`);
      }
    } else {
      ctx.answerCbQuery('ᘜᗩᘜᗩᒪ ᒪOᘜIᑎ ᗪᗴᑎᘜᗩᑎ ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ');
    }
  } catch (error) {
    console.error('Inject error:', error);
    ctx.answerCbQuery(`TᗴᖇᒍᗩᗪI KᗴՏᗩᒪᗩᕼᗩᑎ ՏᗩᗩT ${value < 0 ? 'sedot' : 'inject'} ᑌᗷ!`);
  }
}

// Tangani pesan teks manual
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  const userInfo = await isUserRegisteredAndApproved(telegramId);

  if (!userInfo.registered) {
    await registerDevice(telegramId, text);
    return ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ Tᗴᒪᗩᕼ ᗪIKIᖇIᗰ ᕼᑌᗷᑌᑎᘜI ᗩᗪᗰIᑎ ᑌᑎTᑌK ᑭᗴᖇՏᗴTᑌᒍᑌᗩᑎ');
  }

  if (!userInfo.approved) {
    return ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ ᗷᗴᒪᑌᗰ ᗪIՏᗴTᑌᒍᑌI ᗩᗪᗰIᑎ ᗰOᕼOᑎ ᗷᗴᖇՏᗩᗷᗩᖇ');
  }

  if (text === 'Inject UB') {
    const inlineKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('💰 5 𝘑𝘜𝘛𝘈', 'inject_5000000'),
        Markup.button.callback('💎 10 𝘑𝘜𝘛𝘈', 'inject_10000000')
      ],
      [
        Markup.button.callback('🌟 20 𝘑𝘜𝘛𝘈', 'inject_20000000'),
        Markup.button.callback('🔥 50 𝘑𝘜𝘛𝘈', 'inject_50000000')
      ],
      [
        Markup.button.callback('💸 100 𝘑𝘜𝘛𝘈', 'inject_100000000'),
        Markup.button.callback('💵 200 𝘑𝘜𝘛𝘈', 'inject_200000000')
      ],
      [
        Markup.button.callback('💲 500 𝘑𝘜𝘛𝘈', 'inject_500000000'),
        Markup.button.callback('⬇️ 𝘚𝘌𝘋𝘖𝘛 𝘜𝘉 (-2𝘔)', 'sedot_-2179683487')
      ]
    ]);
    return ctx.reply('🎮 ᗪIՏᑭᒪᗩY ᗰᗴᑎᑌ 🎮', inlineKeyboard);
  } else if (text === 'ᑕᗴK ՏTᗩTᑌՏ') {
    ctx.reply('ᑕOᗰIᑎᘜ ՏOOᑎ...!');
  } else if (text === 'ᗷᗩᑎTᑌᗩᑎ') {
    ctx.reply('🎮 ᘜᑌᑎᗩKᗩᑎ ᗰᗴᑎᑌ ᑎᗩᐯIᘜᗩՏI ᑌᑎTᑌK ᕼᑌᗷᑌᑎᘜI ᗩᗪᗰIᑎ ᒍIKᗩ ᗩᗪᗩ ᗰᗩՏᗩᒪᗩᕼ! 🎮');
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
