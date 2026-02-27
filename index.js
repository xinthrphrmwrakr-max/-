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
  const event = req.body.events[0];
  if (!event || event.type !== 'message' || event.message.type !== 'text') {
    return res.sendStatus(200);
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  if (!users[userId]) {
    users[userId] = { balance: 10000 };
  }

  if (text.toLowerCase() === 'c') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `ยอดเงินของคุณ: ${users[userId].balance}`
    });
  }

  if (text.startsWith('/open')) {
    const parts = text.split(' ');
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
      }
    }
  }

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

  if (text.startsWith('/close')) {
    const winner = text.split(' ')[1];

    bets.forEach(b => {
      if (b.team === winner) {
        const profit = b.amount * 0.9;
        users[b.userId].balance += b.amount + profit;
      }
    });

    currentGame.open = false;

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `ปิดรอบแล้ว\nผู้ชนะ: ${winner}`
    });
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000);
