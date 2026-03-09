require('dotenv').config();

const express = require("express");
const line = require("@line/bot-sdk");
const mongoose = require("mongoose");

const User = require("./models/User");
const Table = require("./models/Table");
const Bet = require("./models/Bet");

const app = express();

/* LINE CONFIG */
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

/* CONNECT MONGO */
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

/* -----------------------------
   MEMORY DATABASE
------------------------------*/

let users = {};
let bets = [];

let fightOpen = false;
let priceOpen = false;

let price = {};
let maxBet = 0;
let totalBet = 0;

/* ADMIN ID */
const ADMIN_ID = "U3bb879084521bbe454c63a2fb7d56c64";

/* WEBHOOK */
app.post("/webhook", line.middleware(config), async (req,res)=>{

try{

const events = req.body.events;

for(const event of events){

if(event.type !== "message") continue;
if(event.message.type !== "text") continue;

const msg = event.message.text.trim();
const uid = event.source.userId;

let profile;

try{
profile = await client.getProfile(uid);
}catch{
profile = { displayName: "สมาชิก" };
}

if(!users[uid]){
users[uid] = {
name: profile.displayName,
credit: 1000
};
}
  
/* =========================
เปิดโต๊ะ
========================= */

if(msg === "เปิดโต๊ะ"){

if(uid !== ADMIN_ID) continue;

fightOpen = true;

await client.replyMessage(event.replyToken,{
type:"text",
text:"🐔 เปิดโต๊ะแล้ว"
});

continue;
}

/* =========================
ปิดโต๊ะ + สรุป
========================= */

if(msg === "ปิดโต๊ะ"){

if(uid !== ADMIN_ID) continue;

fightOpen = false;
priceOpen = false;

let text = "📊 สรุปโต๊ะ\n\n";

bets.forEach(b=>{
text += `${b.name} ${b.side}${b.amount} @${b.price}\n`;
});

await client.replyMessage(event.replyToken,{
type:"text",
text:text
});

bets = [];
totalBet = 0;

continue;
}

/* =========================
เปิดราคา ด/7.5/6/5000
========================= */

if(msg.startsWith("ด/")){

if(uid !== ADMIN_ID) continue;

const sp = msg.split("/");

price = {
r1: sp[1],
r2: sp[2]
};

maxBet = parseInt(sp[3]);
totalBet = 0;

priceOpen = true;

/* FLEX */

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
text:"🐔 เปิดราคาใหม่",
weight:"bold",
size:"xl"
},
{
type:"text",
text:`ต่อ ${price.r2}`
},
{
type:"text",
text:`รอง ${price.r1}`
},
{
type:"text",
text:`รับสูงสุด ${maxBet}`
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

priceOpen = false;

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ ปิดราคาแล้ว"
});

continue;
}
  
/* =========================
ประกาศผล
ผล ด  หรือ  ผล ง
========================= */

if(msg.startsWith("ผล")){

if(uid !== ADMIN_ID) continue;

const winSide = msg.split(" ")[1];

if(!winSide){
await client.replyMessage(event.replyToken,{
type:"text",
text:"ใช้คำสั่ง ผล ด หรือ ผล ง"
});
continue;
}

let summary = "🏆 สรุปผล\n\n";

bets.forEach(b=>{

if(b.side === winSide){

let win = 0;

const r = b.price.split("/");
const r1 = parseFloat(r[0]);
const r2 = parseFloat(r[1]);

if(winSide === "ด"){
win = b.amount + (b.amount * r2 / 10);
}else{
win = b.amount + (b.amount * r1 / 10);
}

users[b.uid].credit += Math.floor(win);

summary += `✅ ${b.name} +${Math.floor(win)}\n`;

}else{

summary += `❌ ${b.name} -${b.amount}\n`;

}

});

await client.replyMessage(event.replyToken,{
type:"text",
text:summary
});

bets = [];
totalBet = 0;

continue;
}
  
/* =========================
แทง
========================= */

if(msg.startsWith("ด") || msg.startsWith("ง")){

if(!fightOpen || !priceOpen){

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ ตอนนี้ยังไม่เปิดราคา"
});

continue;
}

const side = msg[0];
const amount = parseInt(msg.substring(1));

if(isNaN(amount)){

await client.replyMessage(event.replyToken,{
type:"text",
text:"รูปแบบแทงผิด เช่น ด500"
});

continue;
}

/* เช็คยอดเต็ม */

if(totalBet + amount > maxBet){

priceOpen = false;

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ เต็มโต๊ะ ปิดราคา"
});

continue;
}

/* เช็คเครดิต */

if(users[uid].credit < amount){

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ เครดิตไม่พอ"
});

continue;
}

/* หักเครดิต */

users[uid].credit -= amount;

totalBet += amount;

/* บันทึก */

bets.push({
uid:uid,
name:users[uid].name,
side:side,
amount:amount,
price:price.r1+"/"+price.r2
});

/* ตอบ */

await client.replyMessage(event.replyToken,{
type:"text",
text:`${users[uid].name} ${side=="ด"?"ต่อ":"รอง"} ${side}${amount}`
});

continue;
}

/* =========================
เช็คเครดิต
========================= */

if(msg.toLowerCase() === "c"){

let text = `👤 ${users[uid].name}\n`;
text += `💰 เครดิต ${users[uid].credit}\n\n`;

text += "📊 รายการแทง\n";

bets.forEach(b=>{
if(b.uid === uid){
text += `${b.side}${b.amount} @${b.price}\n`;
}
});

await client.replyMessage(event.replyToken,{
type:"text",
text:text
});

continue;
}

/* =========================
แจ้งเติมเงิน
========================= */

if(msg.startsWith("เติม")){

const sp = msg.split(" ");
const amount = parseInt(sp[1]);

if(isNaN(amount)){

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ รูปแบบ เช่น เติม 500"
});

continue;
}

let text = "📥 แจ้งเติมเครดิต\n\n";

text += `👤 ${users[uid].name}\n`;
text += `💰 จำนวน ${amount}\n`;
text += `🆔 USER ID\n${uid}`;

await client.replyMessage(event.replyToken,{
type:"text",
text:text
});

continue;
}
  
/* =========================
แอดมินเพิ่มเครดิต
/add USERID 500
========================= */

if(msg.startsWith("/add")){

if(uid !== ADMIN_ID) continue;

const sp = msg.trim().split(/\s+/);

const target = sp[1];
const amount = Number(sp[2]);

if(!target || isNaN(amount)){

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ ใช้คำสั่ง /add USERID จำนวนเงิน"
});

continue;
}

if(!users[target]){

users[target] = {
name:"USER",
credit:0
};

}

users[target].credit += amount;

await client.replyMessage(event.replyToken,{
type:"text",
text:`✅ เพิ่มเครดิต ${amount}`
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

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log("Server running on "+PORT);
});
