require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

/* LINE CONFIG */
const config = {
 channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
 channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

/* MEMORY DATABASE */

let users = {};
let bets = {};

let fightOpen = false;
let price = null;
let maxBet = 0;
let totalBet = 0;

/* ADMIN */
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

/* โหลดชื่อ */

if(!users[uid]){

const profile = await client.getProfile(uid);

users[uid] = {
name: profile.displayName,
credit: 1000
};

}

/* เปิดราคา */

if(msg.startsWith("ด/")){

if(uid !== ADMIN_ID) continue;

const sp = msg.split("/");

price = {
r1: sp[1],
r2: sp[2]
};

maxBet = parseInt(sp[3]);
totalBet = 0;
fightOpen = true;

await client.replyMessage(event.replyToken,{
type:"text",
text:`🐔 เปิดราคา ${msg}\nรับสูงสุด ${maxBet}`
});

continue;

}

/* ปิดราคา */

if(msg === "ปิดราคา"){

if(uid !== ADMIN_ID) continue;

fightOpen = false;

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ ปิดราคาแล้ว"
});

continue;

}

/* แทง */

if(msg.startsWith("ด") || msg.startsWith("ง")){

if(!fightOpen){

await client.replyMessage(event.replyToken,{
type:"text",
text:"❌ ตอนนี้ปิดราคา"
});

continue;

}

const side = msg[0];
const amount = parseInt(msg.substring(1));

if(isNaN(amount)) continue;

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
side,
amount
});

await client.replyMessage(event.replyToken,{
type:"text",
text:`${users[uid].name} ${side=="ด"?"ต่อ":"รอง"} ${amount}`
});

continue;

}

/* เช็คเครดิต */

if(msg.toLowerCase() === "c"){

let text = `👤 ${users[uid].name}\n`;
text += `💰 เครดิต ${users[uid].credit}\n`;

await client.replyMessage(event.replyToken,{
type:"text",
text:text
});

}

}

res.sendStatus(200);

}catch(err){

console.log(err);
res.sendStatus(500);

}

});

/* TEST SERVER */

app.get("/",(req,res)=>{
res.send("BOT RUNNING");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log("Server running "+PORT);
});
