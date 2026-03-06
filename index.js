require("dotenv").config();

const express=require("express");
const line=require("@line/bot-sdk");
const mongoose=require("mongoose");

const User=require("./models/User");
const Fight=require("./models/Fight");
const Bet=require("./models/Bet");

const app=express();
app.use(express.json());

const config = {
  channelAccessToken: "D/cwg/Hx8zG0YLZIILM1Yjzxx8SJ3EUGqlTOV8qG/9C9Oq1StaXS35vGpdpP0e7/mETEO04/zAjuu4RojiWR/SRZFzTBMpQEeBpgYQbDJ2QMozk76ygLo+FwiR7hx6X7q0yW0uOx27m1cbqf2RgwywdB04t89/1O/w1cDnyilFU=
=",
  channelSecret: "569c57041ab7ff6ffb6b907612716c32"
};

const client=new line.Client(config);

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ Mongo Connected"))
.catch(err=>console.log(err));

const ADMIN="U3bb879084521bbe454c63a2fb7d56c64";
const GROUP_ID="Cbe4b98d3adcc05e91341e544ef99ba5d";


// ================= REPLY =================
function reply(event,text){
return client.replyMessage(event.replyToken,{
type:"text",
text:text
});
}


// ================= WEBHOOK =================
app.post("/webhook",
line.middleware(config),
async(req,res)=>{

try{

await Promise.all(req.body.events.map(handleEvent));
res.sendStatus(200);

}catch(err){

console.error(err);
res.sendStatus(500);

}

});


// ================= RATE =================
function calcPay(rate,amount){

const r=rate.split("/");
return amount*(Number(r[0])/Number(r[1]));

}


// ================= USER =================
async function getUser(event){

const uid=event.source.userId;

let profile;

try{

if(event.source.type==="group"){

profile=
await client.getGroupMemberProfile(
event.source.groupId,
uid
);

}else{

profile=
await client.getProfile(uid);

}

}catch{

profile={displayName:"User"};

}

let user=await User.findOne({userId:uid});

if(!user){

user=await User.create({
userId:uid,
name:profile.displayName,
credit:0
});

}

return user;

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

return client.pushMessage(GROUP_ID,{
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
{type:"separator"},
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

try{

if(event.type!=="message") return null;
if(event.message.type!=="text") return null;

const msg = event.message.text.trim();
const userId = event.source.userId;

if(!user)
return reply(event,"❌ กรุณาพิมพ์ สมัคร ก่อน");

// ================= สมัคร =================
if(msg==="สมัคร"){

let profile;

try{

if(event.source.type==="group"){
profile = await client.getGroupMemberProfile(
event.source.groupId,
userId
);
}else{
profile = await client.getProfile(userId);
}

}catch{
profile={displayName:"สมาชิก"};
}

const displayName = profile.displayName;

if(!user){

user = await User.create({
userId,
name:displayName,
credit:0
});

return reply(event,
`✅ สมัครสมาชิกสำเร็จ
👤 ${displayName}
💰 เครดิต 0`);

}

return reply(event,
`✅ คุณสมัครแล้ว
👤 ${user.name}
💰 เครดิต ${user.credit}`);

}


// ================= เครดิต =================
if(msg==="เครดิต" || msg.toLowerCase()==="c"){

if(!user)
return reply(event,"❌ ยังไม่ได้สมัคร\nพิมพ์ สมัคร");

return reply(event,
`👤 ${user.name}
💰 เครดิต ${user.credit}`);

}


// ===== เติม =====
if(msg.startsWith("เติม")){

if(userId!==ADMIN) return null;

const d = msg.split(" ");

let u = await User.findOne({userId:d[1]});

if(!u){

u = await User.create({
userId:d[1],
credit:0
});

}

u.credit += Number(d[2]);
await u.save();

return reply(event,"✅ เติมเครดิตแล้ว");

}


// ===== เปิดคู่ =====
if(msg.startsWith("เปิดคู่")){

if(userId!==ADMIN) return null;

const d = msg.split(" ");

const fight = await Fight.create({
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
if(/^\d+\s[RB]\s\d+$/i.test(msg)){

if(!user)
return reply(event,"❌ กรุณาสมัครก่อน");

const d = msg.split(" ");

const fight = await Fight.findOne({
fightId:d[0],
status:"open"
});

if(!fight)
return reply(event,"❌ ปิดรับ");

const side=d[1].toUpperCase();
const money=Number(d[2]);

if(user.credit<money)
return reply(event,"เงินไม่พอ");

user.credit-=money;
await user.save();

await Bet.create({
userId,
name:user.name,
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


// ===== ปิดคู่ =====
if(msg.startsWith("ปิดคู่")){

if(userId!==ADMIN) return null;

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
if(msg.startsWith("ชนะ")){

if(userId!==ADMIN) return null;

const d = msg.split(" ");
const id = d[1];
const win = d[2].toUpperCase();

const fight = await Fight.findOne({fightId:id});

const bets = await Bet.find({
fightId:id,
side:win
});

for(const b of bets){

const u = await User.findOne({
userId:b.userId
});

const rate =
win==="R"
?fight.rateRed
:fight.rateBlue;

u.credit +=
b.amount +
calcPay(rate,b.amount);

await u.save();

}

await Fight.updateOne(
{fightId:id},
{status:"finish"}
);

return client.pushMessage(
GROUP_ID,
{
type:"text",
text:`🏆 คู่ ${id} ตัดสินแล้ว`
});

}

return null;

}catch(err){

console.log("HANDLE ERROR:",err);
return reply(event,"⚠️ ระบบกำลังโหลด");

}

}

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log("🚀 BOT RUNNING ON",PORT);
});
