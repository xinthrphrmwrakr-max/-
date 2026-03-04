require("dotenv").config();

const express=require("express");
const line=require("@line/bot-sdk");
const mongoose=require("mongoose");

const User=require("./models/User");
const Fight=require("./models/Fight");
const Bet=require("./models/Bet");

const app=express();

const config={
channelAccessToken:process.env.CHANNEL_ACCESS_TOKEN,
channelSecret:process.env.CHANNEL_SECRET
};

const client=new line.Client(config);

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ Mongo Connected"));

const ADMIN="ใส่USER_ID";
const GROUP_ID="ใส่GROUP_ID";

// ================= WEBHOOK =================
app.post("/webhook",
line.middleware(config),
async(req,res)=>{
await Promise.all(req.body.events.map(handleEvent));
res.json({});
});

// ================= RATE =================
function calcPay(rate,amount){

const r=rate.split("/");
return amount*(parseFloat(r[0])/parseFloat(r[1]));
}

// ================= FLEX =================
async function pushTable(fight){

const bets=await Bet.find({
fightId:fight.fightId
});

let red=0,blue=0;

bets.forEach(b=>{
if(b.side==="R")red+=b.amount;
if(b.side==="B")blue+=b.amount;
});

return client.pushMessage(
GROUP_ID,
{
type:"flex",
altText:"LIVE",
contents:{
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{
type:"text",
text:`🔥 คู่ ${fight.fightId}`,
weight:"bold",
size:"xl"
},
{
type:"text",
text:`🔴 ${fight.red} (${fight.rateRed})`
},
{
type:"text",
text:`ยอด ${red}`
},
{
type:"separator"
},
{
type:"text",
text:`🔵 ${fight.blue} (${fight.rateBlue})`
},
{
type:"text",
text:`ยอด ${blue}`
}
]
}
}
});
}

// ================= EVENT =================
async function handleEvent(event){

if(event.type!=="message")return;
if(event.message.type!=="text")return;

const msg=event.message.text.trim();
const userId=event.source.userId;

let user=await User.findOne({userId});
if(!user) user=await User.create({userId});

// ===== เครดิต =====
if(msg==="เครดิต"){
return reply(event,
`💰 เครดิต ${user.credit}`);
}

// ===== เติม =====
if(msg.startsWith("เติม")){

if(userId!==ADMIN)return;

const d=msg.split(" ");
let u=await User.findOne({userId:d[1]});
if(!u)u=await User.create({userId:d[1]});

u.credit+=parseInt(d[2]);
await u.save();

return reply(event,"✅ เติมแล้ว");
}

// ===== เปิดคู่ =====
// เปิดคู่ 101 แดง น้ำเงิน 10/9 10/9
if(msg.startsWith("เปิดคู่")){

if(userId!==ADMIN)return;

const d=msg.split(" ");

const fight=await Fight.create({
fightId:d[1],
red:d[2],
blue:d[3],
rateRed:d[4],
rateBlue:d[5],
status:"open"
});

return pushTable(fight);
}

// ===== แทง =====
// 101 R 500
if(/^\d+/.test(msg)){

const d=msg.split(" ");

const fight=await Fight.findOne({
fightId:d[0],
status:"open"
});

if(!fight)
return reply(event,"❌ ปิดรับ");

const side=d[1];
const money=parseInt(d[2]);

if(user.credit<money)
return reply(event,"เงินไม่พอ");

user.credit-=money;
await user.save();

await Bet.create({
userId,
fightId:fight.fightId,
side,
amount:money
});

await pushTable(fight);

return reply(event,
`✅ แทงสำเร็จ
คู่ ${fight.fightId}
${side}
${money}`);
}

// ===== ปิด =====
if(msg.startsWith("ปิดคู่")){

if(userId!==ADMIN)return;

await Fight.updateOne(
{fightId:msg.split(" ")[1]},
{status:"close"}
);

return client.pushMessage(
GROUP_ID,
{type:"text",text:"⛔ ปิดรับแทง"}
);
}

// ===== ตัดสิน =====
// ชนะ 101 R
if(msg.startsWith("ชนะ")){

if(userId!==ADMIN)return;

const d=msg.split(" ");
const id=d[1];
const win=d[2];

const fight=await Fight.findOne({fightId:id});

const bets=await Bet.find({
fightId:id,
side:win
});

for(const b of bets){

const u=await User.findOne({
userId:b.userId
});

const rate=
win==="R"
?fight.rateRed
:fight.rateBlue;

u.credit+=b.amount+
calcPay(rate,b.amount);

await u.save();
}

await Fight.updateOne(
{fightId:id},
{status:"finish"}
);

return client.pushMessage(
GROUP_ID,
{type:"text",text:`🏆 คู่ ${id} ตัดสินแล้ว`}
);
}

}

// ================= REPLY =================
function reply(event,text){
return client.replyMessage(
event.replyToken,
{type:"text",text}
);
}

app.listen(3000,
()=>console.log("🚀 BOT V12 RUNNING"));
