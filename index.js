const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: "rULcYwAsV4CS7pD4hWcQvNTvxt3wHIXGjVUfCQFN6rYJkn49wc2jG8EPaqJxJToqmETEO04/zAjuu4RojiWR/SRZFzTBMpQEeBpgYQbDJ2Sr63x4Ia2wu8vfSR9dkgZyur7SI4f56PN0LHSuen+EpwdB04t89/1O/w1cDnyilFU=",
  channelSecret: "5bd5a4a0980d497b71e4eae7d217d1cf"
};

const client = new line.Client(config);

// =====================
// ✅ ADMIN
// =====================
const ADMIN_ID = "U3bb879084521bbe454c63a2fb7d56c64";

// =====================
// ✅ TABLE STATE
// =====================
let tableOpen = false;
let rateRed = 0;
let rateBlue = 0;

let users = {};
let bets = [];

let totalRed = 0;
let totalBlue = 0;

// =====================
// ✅ USER
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
// ✅ WEBHOOK SAFE
// =====================
app.post(
"/webhook",
line.middleware(config),
async (req,res)=>{
try{
await Promise.all(
req.body.events.map(handleEvent)
);
res.status(200).end();
}catch(err){
console.log(err);
res.status(200).end();
}
});

// =====================
// ✅ MAIN EVENT
// =====================
async function handleEvent(event){

if(event.type!=="message") return;
if(event.message.type!=="text") return;

const text =
event.message.text.trim();

let name = "ผู้เล่น";

try {

if(event.source.type === "group"){

const profile =
await client.getGroupMemberProfile(
event.source.groupId,
event.source.userId
);

name = profile.displayName;

}else{

const profile =
await client.getProfile(
event.source.userId
);

name = profile.displayName;

}

}catch(e){
console.log("get name fail");
}

const user =
getUser(
event.source.userId,
name
);

const isAdmin =
event.source.userId===ADMIN_ID;


// =====================
// ✅ CREDIT CHECK
// =====================
if(text.toLowerCase()==="c"){
return reply(event,
`${user.name}
เครดิต ${user.credit.toLocaleString()} 💰`);
}


// =====================
// ✅ OPEN RATE
// /open 10 9
// =====================
const openMatch =
text.match(/^\/open\s(\d+)\s(\d+)/);

if(isAdmin && openMatch){

rateRed=openMatch[1];
rateBlue=openMatch[2];
tableOpen=true;

return reply(event,
`🔥 เปิดราคาแล้ว
🔴 แดง ${rateRed}
🔵 น้ำเงิน ${rateBlue}`);
}


// =====================
// ✅ ADMIN COMMAND
// =====================
if(isAdmin && text==="/ปิดโต๊ะ"){
tableOpen=false;
return reply(event,"🚫 ปิดรับแทง");
}

if(isAdmin && text==="/เปิดโต๊ะ"){
tableOpen=true;
return reply(event,"✅ เปิดรับแทง");
}

if(isAdmin && text==="/ล้างโต๊ะ"){
bets=[];
totalRed=0;
totalBlue=0;
return reply(event,"♻️ ล้างโต๊ะแล้ว");
}

if(isAdmin && text==="/ยกใหม่"){
bets=[];
totalRed=0;
totalBlue=0;
tableOpen=true;
return reply(event,"🔥 เปิดยกใหม่");
}

if(text==="/สรุป")
return replyFlex(event);


// =====================
// ✅ BET SYSTEM
// ด100 ง500
// =====================
const betMatch =
text.match(/^(ด|ง)\s?(\d+)/i);

if(!betMatch) return;

if(!tableOpen)
return reply(event,"🚫 ยังไม่เปิดโต๊ะ");

const side=betMatch[1];
const amount=parseInt(betMatch[2]);

if(user.credit<amount)
return reply(event,"เงินไม่พอ");

user.credit-=amount;

const team=
side==="ด"
?"แดง"
:"น้ำเงิน";

const rate=
team==="แดง"
?rateRed
:rateBlue;

bets.push({
name:user.name,
team,
amount
});

if(team==="แดง")
totalRed+=amount;
else
totalBlue+=amount;

return reply(event,
`${user.name}
${team} ${amount.toLocaleString()} บ. @${rate} ✅ติด
คงเหลือ ${user.credit.toLocaleString()} 💰`);
}

// =====================
// ✅ FLEX SUMMARY
// =====================
function replyFlex(event){

return client.replyMessage(
event.replyToken,{
type:"flex",
altText:"โต๊ะเดิมพัน",
contents:{
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{
type:"text",
text:"📊 สรุปโต๊ะเดิมพัน",
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
},
{
type:"separator",
margin:"md"
},
{
type:"text",
text:`ราคา 🔴${rateRed} / 🔵${rateBlue}`
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

// =====================
app.listen(
process.env.PORT||3000,
()=>console.log("✅ BOT RUNNING PRO MAX")
);
