const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);

let users = {};
let bets = [];
let currentGame = null;

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    await Promise.all(events.map(async (event) => {

      if (event.type !== 'message' || event.message.type !== 'text') {
        return;
      }

      const userId = event.source.userId;
      const text = event.message.text.trim();

      // 🔥 ดึงชื่อผู้ใช้
      let displayName = "ผู้ใช้";

      try {
        if (event.source.type === "group") {
          const profile = await client.getGroupMemberProfile(
            event.source.groupId,
            userId
          );
          displayName = profile.displayName;
        } else {
          const profile = await client.getProfile(userId);
          displayName = profile.displayName;
        }
      } catch (err) {
        console.log("ดึงชื่อไม่สำเร็จ ใช้ค่า default");
      }

      console.log("ข้อความเข้า:", text, "จาก:", displayName);

      if (!users[userId]) {
        users[userId] = { balance: 10000 };
      }

      // 💰 เช็คยอด
      if (text.toLowerCase() === 'c') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `${displayName} ยอดเงินของคุณ: ${users[userId].balance}`
        });
      }

      // 🟢 เปิดรอบ
      if (text.startsWith('/open')) {
        const parts = text.split(' ');

        if (parts.length < 4) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'รูปแบบ: /open ทีมA ทีมB ราคา'
          });
        }

        currentGame = {
          teamA: parts[1],
          teamB: parts[2],
          rate: parts[3],
          open: true
        };

        bets = [];

        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `📢 ${displayName} เปิดรับเดิมพัน\n${parts[1]} vs ${parts[2]}\nราคา ${parts[3]}`
        });
      }

      // 🎯 แทง
      if (currentGame && currentGame.open) {
        const parts = text.split(' ');
        const team = parts[0];
        const amount = parseInt(parts[1]);

        if ((team === currentGame.teamA || team === currentGame.teamB) && amount > 0) {

          if (users[userId].balance >= amount) {

            users[userId].balance -= amount;
            bets.push({ userId, team, amount, name: displayName });

            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `✅ ${displayName} แทง ${team} ${amount} สำเร็จ`
            });

          } else {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `❌ ${displayName} ยอดเงินไม่พอ`
            });
          }
        }
      }

      // 📋 ดูรายการแทง
      if (text === '/list') {
        if (bets.length === 0) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'ยังไม่มีรายการแทง'
          });
        }

        let summary = '📊 สรุปการเดิมพัน\n';
        bets.forEach(b => {
          summary += `${b.name} → ${b.team} ${b.amount}\n`;
        });

        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: summary
        });
      }

      // 🔴 ปิดรอบ
      if (text.startsWith('/close')) {
        const winner = text.split(' ')[1];

        bets.forEach(b => {
          if (b.team === winner) {
            const profit = b.amount * 0.9;
            users[b.userId].balance += b.amount + profit;
          }
        });

        if (currentGame) currentGame.open = false;

        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `🏆 ${displayName} ปิดรอบแล้ว\nผู้ชนะ: ${winner}`
        });
      }

      // ถ้าไม่เข้าเงื่อนไขไหน
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `${displayName} พิมพ์ว่า: ${text}`
      });

    }));

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.send('Bot is running 🚀');
});

app.listen(process.env.PORT || 3000);
