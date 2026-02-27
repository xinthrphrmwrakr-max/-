const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);

// ===== DATABASE =====
let users = {};
let bets = [];
let currentGame = null;

// 👑 ใส่ USER ID แอดมิน
const ADMINS = ["U3bb879084521bbe454c63a2fb7d56c64"];

app.post('/webhook', line.middleware(config), async (req, res) => {

  const events = req.body.events;

  await Promise.all(events.map(async (event) => {

    if (event.type !== 'message' || event.message.type !== 'text')
      return;

    const userId = event.source.userId;
    const text = event.message.text.trim();

    // ===== ดึงชื่อ =====
    let name = "ผู้เล่น";

    try {
      if (event.source.type === "group") {
        const profile =
          await client.getGroupMemberProfile(
            event.source.groupId,
            userId
          );
        name = profile.displayName;
      }
    } catch {}

    if (!users[userId])
      users[userId] = { balance: 20000 };

    // =========================
    // 💰 เครดิต
    // =========================
    if (text === "c") {
      return client.replyMessage(event.replyToken,{
        type:'text',
        text:`${name}\nเครดิต ${users[userId].balance.toLocaleString()} 💰`
      });
    }

    // =========================
    // 👑 เปิดโต๊ะ
    // =========================
    if (text.startsWith("/open")) {

      if (!ADMINS.includes(userId))
        return;

      const p = text.split(" ");

      currentGame = {
        teamA:p[1],
        teamB:p[2],
        rate:p[3],
        open:true
      };

      bets=[];

      return client.replyMessage(event.replyToken,{
        type:'text',
        text:
`📢 เปิดโต๊ะแล้ว
${p[1]} 🆚 ${p[2]}
ราคา ${p[3]}`
      });
    }

    // =========================
    // 🎯 แทง
    // =========================
    if(currentGame && currentGame.open){

      const p=text.split(" ");
      const team=p[0];
      const amount=parseInt(p[1]);

      if(
        (team===currentGame.teamA ||
         team===currentGame.teamB)
         && amount>0
      ){

        if(users[userId].balance<amount){
          return client.replyMessage(event.replyToken,{
            type:'text',
            text:`${name}\n❌ เครดิตไม่พอ`
          });
        }

        users[userId].balance-=amount;

        bets.push({
          userId,
          name,
          team,
          amount
        });

        return client.replyMessage(event.replyToken,{
          type:'text',
text:
`${name}
${team} ${amount.toLocaleString()} บ. ✅ติด
คงเหลือ ${users[userId].balance.toLocaleString()} 💰`
        });
      }
    }

    // =========================
    // 📊 รวมยอด
    // =========================
    if(text==="/sum"){

      let a=0,b=0;

      bets.forEach(x=>{
        if(x.team===currentGame.teamA) a+=x.amount;
        if(x.team===currentGame.teamB) b+=x.amount;
      });

      return client.replyMessage(event.replyToken,{
        type:'text',
text:
`📊 ยอดรวม
${currentGame.teamA} : ${a.toLocaleString()}
${currentGame.teamB} : ${b.toLocaleString()}`
      });
    }

    // =========================
    // 🏆 ปิดโต๊ะ
    // =========================
    if(text.startsWith("/close")){

      if(!ADMINS.includes(userId))
        return;

      const win=text.split(" ")[1];

      bets.forEach(b=>{
        if(b.team===win){
          const pay=b.amount*1.9;
          users[b.userId].balance+=pay;
        }
      });

      currentGame.open=false;

      return client.replyMessage(event.replyToken,{
        type:'text',
        text:`🏆 ${win} ชนะ\nจ่ายเงินเรียบร้อย`
      });
    }

  }));

  res.sendStatus(200);
});

app.listen(process.env.PORT||3000);
