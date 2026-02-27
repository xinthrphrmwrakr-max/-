const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: "ใส่ Channel Access Token",
  channelSecret: "ใส่ Channel Secret"
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => res.json({ status: "ok" }));
});

// ======================
// ✅ ระบบโต๊ะ
// ======================

let users = {};
let tableLimit = 50000; // โต๊ะเต็ม
let totalBet = 0;

function getUser(id, name) {
  if (!users[id]) {
    users[id] = {
      name: name,
      credit: 20000
    };
  }
  return users[id];
}

// ======================
// ✅ HANDLE EVENT
// ======================

async function handleEvent(event) {

  if (event.type !== "message" || event.message.type !== "text")
    return null;

  const text = event.message.text.trim();

  const profile = await client.getProfile(event.source.userId);
  const user = getUser(event.source.userId, profile.displayName);

  // ======================
  // ✅ ด1000 / ง500
  // ======================

  const betMatch = text.match(/^(ด|ง)(\d+)/i);

  if (!betMatch) return null; // ❌ ไม่ตอบแชททั่วไป

  let side = betMatch[1];
  let amount = parseInt(betMatch[2]);

  if (amount <= 0)
    return reply(event.replyToken, "❌ จำนวนไม่ถูกต้อง");

  if (user.credit < amount)
    return reply(event.replyToken, "❌ เครดิตไม่พอ");

  if (totalBet + amount > tableLimit)
    return reply(event.replyToken, "🚫 โต๊ะเต็มแล้ว");

  // หักเงิน
  user.credit -= amount;
  totalBet += amount;

  let team = side === "ด" ? "แดง" : "น้ำเงิน";

  let msg =
`${user.name}
${team} ${amount.toLocaleString()} บ. ✅ติด
คงเหลือ ${user.credit.toLocaleString()} 💰`;

  return reply(event.replyToken, msg);
}

// ======================
// ✅ Reply
// ======================

function reply(token, text) {
  return client.replyMessage(token, {
    type: "text",
    text: text
  });
}

app.listen(process.env.PORT || 3000);
