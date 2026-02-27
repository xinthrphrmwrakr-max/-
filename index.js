const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: "CHANNEL_ACCESS_TOKEN",
  channelSecret: "CHANNEL_SECRET"
};

const client = new line.Client(config);

// =====================
// ✅ ตั้งค่าโต๊ะ
// =====================

const ADMIN_ID = "5bd5a4a0980d497b71e4eae7d217d1cf";

let tableOpen = false;
let tableLimit = 100000;

let users = {};
let bets = [];

let totalRed = 0;
let totalBlue = 0;

// =====================

function getUser(id, name) {
  if (!users[id]) {
    users[id] = {
      name,
      credit: 20000
    };
  }
  return users[id];
}

// =====================

app.post("/webhook",
  line.middleware(config),
  (req, res) => {
    Promise.all(req.body.events.map(handleEvent));
    res.sendStatus(200);
  }
);

// =====================

async function handleEvent(event) {

  if (event.type !== "message") return;

  const text = event.message.text.trim();

  const profile =
    await client.getProfile(event.source.userId);

  const user =
    getUser(event.source.userId,
    profile.displayName);

  const isAdmin =
    event.source.userId === ADMIN_ID;

  // =====================
  // ✅ ADMIN COMMAND
  // =====================

  if (isAdmin && text === "/เปิดโต๊ะ") {
    tableOpen = true;
    return reply(event, "✅ เปิดรับแทงแล้ว");
  }

  if (isAdmin && text === "/ปิดโต๊ะ") {
    tableOpen = false;
    return reply(event, "🚫 ปิดรับแทง");
  }

  if (isAdmin && text === "/ล้างโต๊ะ") {
    bets = [];
    totalRed = 0;
    totalBlue = 0;
    return reply(event, "♻️ ล้างโต๊ะแล้ว");
  }

  if (isAdmin && text === "/ยกใหม่") {
    bets = [];
    totalRed = 0;
    totalBlue = 0;
    tableOpen = true;
    return reply(event, "🔥 เปิดยกใหม่");
  }

  if (text === "/สรุป")
    return replyFlex(event);

  // =====================
  // ✅ แทง ด1000 ง500
  // =====================

  const betMatch =
    text.match(/^(ด|ง)(\d+)/i);

  if (!betMatch) return;

  if (!tableOpen)
    return reply(event, "🚫 ยังไม่เปิดโต๊ะ");

  let side = betMatch[1];
  let amount =
    parseInt(betMatch[2]);

  if (user.credit < amount)
    return reply(event,"เงินไม่พอ");

  user.credit -= amount;

  let team =
    side === "ด" ? "แดง" : "น้ำเงิน";

  bets.push({
    name:user.name,
    team,
    amount
  });

  if (team==="แดง")
    totalRed+=amount;
  else
    totalBlue+=amount;

  return reply(event,
`${user.name}
${team} ${amount.toLocaleString()} บ. ✅ติด
คงเหลือ ${user.credit.toLocaleString()} 💰`);
}

// =====================
// ✅ FLEX SUMMARY
// =====================

function replyFlex(event){

return client.replyMessage(
event.replyToken,{
type:"flex",
altText:"สรุปโต๊ะ",
contents:{
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{
type:"text",
text:"📊 สรุปยอดเดิมพัน",
weight:"bold",
size:"lg"
},
{
type:"text",
text:`🔴 แดง ${totalRed.toLocaleString()}`
},
{
type:"text",
text:`🔵 น้ำเงิน ${totalBlue.toLocaleString()}`
}
]
}
}
});
}

// =====================

function reply(event,text){
return client.replyMessage(
event.replyToken,{
type:"text",
text
});
}

app.listen(process.env.PORT||3000);
