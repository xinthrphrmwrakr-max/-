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
.then(()=> console.log("MongoDB Connected"))
.catch(err=> console.log(err));

/* -----------------------------
   MEMORY DATABASE
------------------------------*/

let users = {};
let bets = {};

let fightOpen = false;
let price = null;
let maxBet = 0;
let totalBet = 0;

/* ADMIN */
const ADMIN_ID = "ใส่USERIDแอดมิน";

/* WEBHOOK */
app.post("/webhook", line.middleware(config), async (req,res)=>{
try{

const events = req.body.events;

for(const event of events){

if(event.type !== "message") continue;
if(event.message.type !== "text") continue;

const msg = event.message.text.trim();
const uid = event.source.userId;

// ทดสอบดู USER ID
console.log("USER ID:", uid);

}

res.sendStatus(200);

}catch(err){
console.log(err);
res.sendStatus(500);
}
});

/* โหลดชื่อผู้ใช้ */
const profile = await client.getProfile(uid);

if(!users[uid]){
users[uid] = {
name: profile.displayName,
credit: 1000
};
}

/* =========================
   เปิดราคาแบบ ด/7/5/5000
========================= */

if(msg.startsWith("ด/")){

if(uid !== ADMIN_ID) continue;

const sp = msg.split("/");

price = {
side: sp[0],
r1: sp[1],
r2: sp[2]
};

maxBet = parseInt(sp[3]);
totalBet = 0;

fightOpen = true;

/* FLEX MESSAGE */

const flex = {
type:"flex",
altText:"ราคาไก่",
contents:{
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{
type:"text",
text:msg,
size:"xl",
weight:"bold",
align:"center",
color:"#ffffff",
backgroundColor:"#ff2b2b",
margin:"md"
},
{
type:"text",
text:`ต่อได้${price.r2} เสีย${price.r1}`,
align:"center",
size:"lg",
color:"#ff2b2b",
margin:"lg"
},
{
type:"text",
text:`รองได้${price.r1} เสีย${price.r2}`,
align:"center",
size:"lg",
color:"#0066ff"
},
{
type:"text",
text:`รับสูงสุด ${maxBet}`,
align:"center",
margin:"md",
size:"sm"
}
]
}
}
};

await client.replyMessage(event.replyToken,flex);

continue;
}

/* =========================
   ปิดราคา
========================= */

if(msg === "ปิดราคา"){

if(uid !== ADMIN_ID) continue;

fightOpen = false;

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ ปิดราคาแล้ว"
});

continue;
}

/* =========================
   แทง
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
text:"รูปแบบเดิมพันผิด"
});
continue;
}

if(totalBet + amount > maxBet){

fightOpen = false;

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ เต็มโต๊ะ ปิดราคา"
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

totalBet += amount;

if(!bets[uid]) bets[uid] = [];

bets[uid].push({
side:side,
amount:amount,
price:price.r1+"/"+price.r2
});

await client.replyMessage(event.replyToken,{
type:"text",
text:`${users[uid].name} ${side=="ด"?"ต่อ":"รอง"} ${amount}`
});

continue;
}

/* =========================
   เช็คเครดิต
========================= */

if(msg.toLowerCase() === "c"){

let text = `👤 ${users[uid].name}\n`;
text += `💰 เครดิต ${users[uid].credit}\n`;

if(bets[uid]){

text += "\n🐔 รายการแทง\n";

bets[uid].forEach(b=>{
text += `${b.side}${b.amount} @${b.price}\n`;
});

}

await client.replyMessage(event.replyToken,{
type:"text",
text:text
});

continue;
}

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
