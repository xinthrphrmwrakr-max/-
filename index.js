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

      console.log("ข้อความเข้า:", text);
      console.log("source type:", event.source.type);

      if (!users[userId]) {
        users[userId] = { balance: 10000 };
      }

      // เช็คยอดเงิน
      if (text.toLowerCase() === 'c') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `ยอดเงินของคุณ: ${users[userId].balance}`
        });
      }

      // เปิดรอบ
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
          text: `เปิดรับเดิมพัน\n${parts[1]} vs ${parts[2]}\nราคา ${parts[3]}`
        });
      }

      // แทง
      if (currentGame && currentGame.open) {
        const parts = text.split(' ');
        const team = parts[0];
        const amount = parseInt(parts[1]);

        if ((team === currentGame.teamA || team === currentGame.teamB) && amount > 0) {
          if (users[userId].balance >= amount) {

            users[userId].balance -= amount;
            bets.push({ userId, team, amount });

            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `แทง ${team} ${amount} สำเร็จ`
            });
          } else {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `ยอดเงินไม่พอ`
            });
          }
        }
      }

      // ดูรายการแทง
      if (text === '/list') {
        let summary = 'สรุปการเดิมพัน\n';

        bets.forEach(b => {
          summary += `${b.team} ${b.amount}\n`;
        });

        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: summary
        });
      }

      // ปิดรอบ
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
          text: `ปิดรอบแล้ว\nผู้ชนะ: ${winner}`
        });
      }

      // ถ้าไม่เข้าเงื่อนไขไหนเลย
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `ได้รับข้อความ: ${text}`
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
