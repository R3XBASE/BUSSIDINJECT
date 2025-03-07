const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const http = require('http');

// Server HTTP untuk Koyeb
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});
server.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on port ${process.env.PORT || 8080}`);
});

// Konfigurasi PostgreSQL dari environment variables untuk Neon
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false } // Neon memerlukan SSL, atur sesuai kebutuhan
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Fungsi PlayFab Login
async function loginWithDevice(deviceId) {
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
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return data.data && data.data.SessionTicket ? data.data.SessionTicket : null;
}

// Fungsi PlayFab Add RP
async function addRp(xAuth, value) {
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
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return await response.json();
}

// Cek apakah pengguna disetujui
async function isUserApproved(telegramId) {
  try {
    const result = await pool.query('SELECT approved FROM users WHERE telegram_id = $1', [telegramId]);
    return result.rows.length > 0 && result.rows[0].approved;
  } catch (error) {
    console.error('Database error:', error);
    return false;
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
  if (!(await isUserApproved(telegramId))) {
    return ctx.reply('Masukkan Device ID Anda terlebih dahulu:');
  }
  const keyboard = {
    reply_markup: {
      keyboard: [['Inject UB', 'Cek Status'], ['Bantuan']],
      one_time_keyboard: true
    }
  };
  ctx.reply('Selamat datang! Pilih menu:', keyboard);
});

// Tangani pesan
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const text = ctx.message.text;

  if (!(await isUserApproved(telegramId))) {
    await registerDevice(telegramId, text);
    return ctx.reply('Device ID Anda telah dikirim untuk persetujuan admin. Tunggu hingga disetujui.');
  }

  if (text === 'Inject UB') {
    ctx.reply('Masukkan jumlah UB yang ingin di-inject:');
    ctx.session = { state: 'waiting_for_rp' };
  } else if (text === 'Cek Status') {
    ctx.reply('Fitur ini belum diimplementasikan.');
  } else if (text === 'Bantuan') {
    ctx.reply('Gunakan menu untuk navigasi. Hubungi admin jika ada masalah.');
  } else if (ctx.session && ctx.session.state === 'waiting_for_rp') {
    try {
      const rpValue = parseInt(text);
      if (isNaN(rpValue)) throw new Error('Invalid number');

      const result = await pool.query('SELECT device_id FROM users WHERE telegram_id = $1', [telegramId]);
      const deviceId = result.rows[0]?.device_id;

      if (!deviceId) throw new Error('Device ID not found');

      const sessionTicket = await loginWithDevice(deviceId);
      if (sessionTicket) {
        const result = await addRp(sessionTicket, rpValue);
        ctx.reply(`Sukses Inject UB: ${JSON.stringify(result, null, 2)}`);
      } else {
        ctx.reply('Gagal login dengan Device ID Anda.');
      }
    } catch (error) {
      console.error('Error:', error);
      ctx.reply('Masukkan angka yang valid atau ada masalah dengan server!');
    } finally {
      ctx.session.state = null;
    }
  }
});

// Jalankan bot
bot.launch().then(() => {
  console.log('Bot berjalan...');
}).catch((err) => {
  console.error('Bot gagal berjalan:', err);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Tutup pool saat aplikasi berhenti
process.on('exit', () => pool.end());
