require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const mongoose = require("mongoose");

const app = express();

/* LINE CONFIG */
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

/* CONNECT MONGODB */
mongoose.connect(process.env.MONGO_URI)
.then(()=>{
  console.log("MongoDB Connected");
})
.catch(err=>{
  console.log(err);
});

/* -----------------------------
   MEMORY DATABASE
------------------------------*/

let users = {};
let bets = {};

let fightOpen = false; // เปิดราคาไหม
let price = null;      // ราคาปัจจุบัน
let maxBet = 0;       // จำกัดยอด
let totalBet = 0;     // ยอดรวม

/* ADMIN */
const ADMIN_ID = "ใส่USER_IDแอดมิน";

/* WEBHOOK */
app.post("/webhook", line.middleware(config), async (req,res)=>{
  try{

    const events = req.body.events;

    for(const event of events){

      if(event.type !== "message") continue;
      if(event.message.type !== "text") continue;

      const msg = event.message.text.trim();
      const uid = event.source.userId;
      /* ดู USER ID ใน Log */
console.log("USER ID =", uid);

/* ดึงชื่อ LINE */
const profile = await client.getProfile(uid);

      /* ดึงชื่อ LINE */
      const profile = await client.getProfile(uid);

      if(!users[uid]){
        users[uid] = {
          name: profile.displayName,
          credit: 1000
        };
      }

      /* =========================
         เปิดราคา (แอดมิน)
      ========================= */

      if(msg === "เปิดราคา"){
        fightOpen = true;

        await client.replyMessage(event.replyToken,{
          type:"text",
          text:"🐔 เปิดราคาแล้ว"
        });

        continue;
      }

      /* =========================
         ปิดราคา
      ========================= */

      if(msg === "ปิดราคา"){
        fightOpen = false;

        await client.replyMessage(event.replyToken,{
          type:"text",
          text:"❌ ปิดราคาแล้ว"
        });

        continue;
      }

      /* =========================
         แทง ด / ง
      ========================= */

      if(msg.startsWith("ด") || msg.startsWith("ง")){

        if(!fightOpen){
          await client.replyMessage(event.replyToken,{
            type:"text",
            text:"❌ ตอนนี้ปิดราคาอยู่"
          });
          continue;
        }

        const side = msg[0];
        const amount = parseInt(msg.substring(1));

        if(isNaN(amount)){
          await client.replyMessage(event.replyToken,{
            type:"text",
            text:"❌ รูปแบบเดิมพันผิด เช่น ด500"
          });
          continue;
        }

        if(users[uid].credit < amount){
          await client.replyMessage(event.replyToken,{
            type:"text",
            text:"❌ เครดิตไม่พอ"
          });
          continue;
        }

        users[uid].credit -= amount;

        if(!bets[uid]) bets[uid] = [];

        bets[uid].push({
          side: side,
          amount: amount
        });

        await client.replyMessage(event.replyToken,{
          type:"text",
          text:"✅ รับเดิมพัน "+msg
        });

        continue;
      }

      /* =========================
         เช็คเครดิต
      ========================= */

      if(msg.toLowerCase() === "c"){

        let text = "👤 "+users[uid].name+"\n";
        text += "💰 เครดิต : "+users[uid].credit+"\n";

        if(fightOpen && bets[uid]){

          text += "\n🐔 รายการแทง\n";

          bets[uid].forEach(b=>{
            text += b.side+" "+b.amount+"\n";
          });

        }

        await client.replyMessage(event.replyToken,{
          type:"text",
          text:text
        });

        continue;
      }

      /* =========================
         ไม่ตอบอะไร
      ========================= */

    }

    res.status(200).end();

  }catch(err){
    console.log(err);
    res.status(200).end();
  }
});

/* TEST SERVER */

app.get("/",(req,res)=>{
  res.send("BOT RUNNING");
});

const port = process.env.PORT || 3000;

app.listen(port,()=>{
  console.log("Server "+port);
});
