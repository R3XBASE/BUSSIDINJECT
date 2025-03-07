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

// Fungsi PlayFab Login dengan penanganan error
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
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.data?.SessionTicket || null;
  } catch (error) {
    console.error('LoginWithDevice error:', error.message);
    return null;
  }
}

// Fungsi PlayFab Add RP dengan penanganan error
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
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('AddRp error:', error.message);
    return { error: 'Failed to add RP' };
  }
}

// Cek apakah pengguna terdaftar dan disetujui dengan penanganan error
async function isUserRegisteredAndApproved(telegramId) {
  try {
    const result = await pool.query('SELECT device_id, approved FROM users WHERE telegram_id = $1', [telegramId]);
    const user = result.rows[0];
    return user ? { registered: true, approved: user.approved, deviceId: user.device_id } : { registered: false, approved: false, deviceId: null };
  } catch (error) {
    console.error('Database error:', error.message);
    return { registered: false, approved: false, deviceId: null };
  }
}

// Daftarkan Device ID dengan penanganan error
async function registerDevice(telegramId, deviceId) {
  try {
    await pool.query('INSERT INTO users (telegram_id, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [telegramId, deviceId]);
  } catch (error) {
    console.error('RegisterDevice error:', error.message);
  }
}

// Command /inject dengan penanganan error
bot.command('inject', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const userInfo = await isUserRegisteredAndApproved(telegramId);

    if (!userInfo.registered) {
      return await ctx.reply('ᗰᗩՏᑌKKᗩᑎ ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ');
    }

    if (!userInfo.approved) {
      return await ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ ᗷᗴᒪᑌᗰ ᗪI ՏᗴTᑌᒍᑌI ᗰOᕼOᑎ Tᑌᑎᘜᘜᑌ');
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
        Markup.button.callback('⬇️ 𝘚𝘌𝘋𝘖𝘛 𝘜𝘉 (-2𝘔)', 'sedot_-2147483647')
      ]
    ]);

    await ctx.reply('🎮 ᑭIᒪIᕼ OᑭՏI IᑎᒍᗴᑕT ᗩTᗩᑌ ՏᗴᗪOT 🎮', inlineKeyboard);
  } catch (error) {
    console.error('Inject command error:', error.message);
    await ctx.reply('ᗩᗪᗩ KᗴՏᗩᒪᗩᕼᗩᑎ!');
  }
});

// Tangani callback query dari inline keyboard dengan penanganan error
bot.action(/inject_(\d+)/, async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const value = parseInt(ctx.match[1]);
    await handleInject(ctx, telegramId, value);
  } catch (error) {
    console.error('Callback inject error:', error.message);
    await ctx.answerCbQuery('ᗩᗪᗩ KᗴՏᗩᒪᗩᕼᗩᑎ ՏᗩᗩT ᑭᖇOSᗴՏ!');
  }
});

bot.action('sedot_-2147483647', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    await handleInject(ctx, telegramId, -2147483647);
  } catch (error) {
    console.error('Callback sedot error:', error.message);
    await ctx.answerCbQuery('ᗩᗪᗩ KᗴՏᗩᒪᗩᕼᗩᑎ ՏᗩᗩT ᑭᖇOSᗴՏ!');
  }
});

// Fungsi handler untuk inject dengan penanganan error
async function handleInject(ctx, telegramId, value) {
  try {
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

    const sessionTicket = await loginWithDevice(deviceId);
    if (!sessionTicket) {
      return ctx.answerCbQuery('ᘜᗩᘜᗩᒪ ᒪOᘜIᑎ ᗪᗴᑎᘜᗩᑎ ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ');
    }

    const result = await addRp(sessionTicket, value);
    if (result.error) {
      ctx.answerCbQuery(`Gagal ${value < 0 ? 'sedot' : 'inject'} UB: ${result.error}`);
    } else {
      const action = value < 0 ? 'Sedot' : 'Inject';
      const absValue = Math.abs(value).toLocaleString();
      ctx.answerCbQuery(`${action} ${absValue} ᑌᗷ ᗷᗴᖇᕼᗩՏIᒪ!`);
      await ctx.reply(`${action} ${absValue} ՏᑌKՏᗴՏ ᗯᗩK`, {
        reply_to_message_id: ctx.callbackQuery.message.message_id
      });
    }
  } catch (error) {
    console.error('HandleInject error:', error.message);
    await ctx.answerCbQuery(`TᗴᖇᒍᗩᗪI KᗴՏᗩᒪᗩᕼᗩᑎ ՏᗩᗩT ${value < 0 ? 'sedot' : 'inject'} ᑌᗷ!`);
  }
}

// Tangani pesan teks manual dengan penanganan error (hanya menerima reply untuk device ID dan hapus pesan)
bot.on('text', async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const text = ctx.message.text;
    const messageId = ctx.message.message_id;
    const chatId = ctx.chat.id;

    const userInfo = await isUserRegisteredAndApproved(telegramId);

    // Jika pengguna belum terdaftar, hanya terima reply untuk pesan "Masukkan Device ID Anda"
    if (!userInfo.registered) {
      // Periksa apakah pesan ini adalah reply
      if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.text.includes('ᗰᗩՏᑌKKᗩᑎ ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ')) {
        return; // Abaikan jika bukan reply untuk pesan yang tepat
      }

      // Validasi input: hanya huruf atau string, bukan nomor murni
      if (/^\d+$/.test(text)) {
        await ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᕼᗩᖇᑌՏ ᗷᗴᖇᑌᑭᗩ ᕼᑌᖇᑌᖴ ᗩTᗩᑌ ՏTᖇIᑎᘜ, ᗷᑌKᗩᑎ ᗩᑎᘜKᗩ!', {
          reply_to_message_id: messageId
        });
        return;
      }

      await registerDevice(telegramId, text);
      await ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ Tᗴᒪᗩᕼ ᗪIKIᖇIᗰ ᕼᑌᗷᑌᑎᘜI ᗩᗪᗰIᑎ ᑌᑎTᑌK ᑭᗴᖇՏᗴTᑌᒍᑌᗩᑎ', {
        reply_to_message_id: messageId
      });

      // Hapus pesan pengguna setelah diproses
      try {
        await bot.telegram.deleteMessage(chatId, messageId);
      } catch (deleteError) {
        console.error('Failed to delete message:', deleteError.message);
        // Opsional: Kirim notifikasi jika penghapusan gagal
        await ctx.reply('ᗩᗪᗩ KᗴՏᗩᒪᗩᕼᗩᑎ ᗰᗴᑎᕼᗩᑭᑌՏ ᑭᗴՏᗩᑎ ᗩᑎᗪᗩ!');
      }
      return;
    }

    if (!userInfo.approved) {
      return await ctx.reply('ᗪᗴᐯIᑕᗴ Iᗪ ᗩᑎᗪᗩ ᗷᗴᒪᑌᗰ ᗪIՏᗴTᑌᒍᑌI ᗩᗪᗰIᑎ ᗰOᕼOᑎ ᗷᗴᖇՏᗩᗷᗩᖇ');
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
          Markup.button.callback('⬇️ 𝘚𝘌𝘋𝘖𝘛 𝘜𝘉 (-2𝘔)', 'sedot_-2147483647')
        ]
      ]);
      await ctx.reply('🎮 ᗪIՏᑭᒪᗩY ᗰᗴᑎᑌ 🎮', inlineKeyboard);
    } else if (text === 'Cek Status') {
      await ctx.reply('ᑕOᗰIᑎᘜ ՏOOᑎ...!');
    } else if (text === 'Bantuan') {
      await ctx.reply('🎮 ᘜᑌᑎᗩKᗩᑎ ᗰᗴᑎᑌ ᑎᗩᐯIᘜᗩՏI ᑌᑎTᑌK ᕼᑌᗷᑌᑎᘜI ᗩᗪᗰIᑎ ᒍIKᗩ ᗩᗪᗩ ᗰᗩՏᗩᒪᗩᕼ! 🎮');
    } else {
      await ctx.reply('ᑭᗴᔕᗩᑎ TᗴᖇIᑎᗪᗩᕼ ᗷᗴᒪᑌᗰ ᗪI ՏᗴTᗴᒪ!');
    }
  } catch (error) {
    console.error('Text handler error:', error.message);
    await ctx.reply('ᗩᗪᗩ KᗴՏᗩᒪᗩᕼᗩᑎ!');
  }
});

// Jalankan bot dengan penanganan error global
bot.launch().then(() => {
  console.log('Bot berjalan...');
}).catch((err) => {
  console.error('Bot launch error:', err.message);
  // Bot akan tetap berjalan meskipun ada error saat launch
});

// Graceful shutdown dengan penanganan error
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  pool.end((err) => {
    if (err) console.error('Pool end error:', err.message);
    process.exit(0);
  });
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  pool.end((err) => {
    if (err) console.error('Pool end error:', err.message);
    process.exit(0);
  });
});

// Tutup pool saat aplikasi berhenti
process.on('exit', () => {
  pool.end((err) => {
    if (err) console.error('Pool end error:', err.message);
  });
});
