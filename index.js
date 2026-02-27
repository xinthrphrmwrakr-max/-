const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: "rULcYwAsV4CS7pD4hWcQvNTvxt3wHIXGjVUfCQFN6rYJkn49wc2jG8EPaqJxJToqmETEO04/zAjuu4RojiWR/SRZFzTBMpQEeBpgYQbDJ2Sr63x4Ia2wu8vfSR9dkgZyur7SI4f56PN0LHSuen+EpwdB04t89/1O/w1cDnyilFU=",
  channelSecret: "5bd5a4a0980d497b71e4eae7d217d1cf"
};

const client = new line.Client(config);

// ================= ADMIN =================
const ADMIN_ID = "U3bb879084521bbe454c63a2fb7d56c64";

// ================= TABLE =================
let tableOpen=false;
let rateRed=0;
let rateBlue=0;

const MAX_TABLE=100000;
const MAX_USER_BET=20000;

let users={};
let bets=[];

let totalRed=0;
let totalBlue=0;


// ================= USER =================
function getUser(id,name){
if(!users[id]){
users[id]={
name,
credit:20000,
roundBet:0
};
}
return users[id];
}


// ================= WEBHOOK =================
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
console.log("ERROR:",err);
res.status(200).end();
}
});


// ================= MAIN =================
async function handleEvent(event){

if(event.type!=="message") return;
if(event.message.type!=="text") return;

const text=event.message.text.trim();

const profile=
await client.getProfile(event.source.userId);

const user=
getUser(event.source.userId,profile.displayName);

const isAdmin=
event.source.userId===ADMIN_ID;


// ========= CREDIT =========
if(text.toLowerCase()==="c"){
return reply(event,
`${user.name}
💰 เครดิต ${user.credit.toLocaleString()}`);
}


// ========= OPEN RATE =========
const open=text.match(/^\/open\s(\d+)\s(\d+)/);

if(isAdmin && open){

rateRed=parseInt(open[1]);
rateBlue=parseInt(open[2]);
tableOpen=true;

resetRound();

return reply(event,
`🔥 เปิดราคา
🔴 ${rateRed}
🔵 ${rateBlue}`);
}


// ========= BET =========
const bet=text.match(/^(ด|ง)\s?(\d+)/i);
if(!bet) return;

if(!tableOpen)
return reply(event,"🚫 ปิดรับแทง");

const amount=parseInt(bet[2]);

if(user.credit<amount)
return reply(event,"❌ เครดิตไม่พอ");

if(user.roundBet+amount>MAX_USER_BET)
return reply(event,"⚠️ เกินวงเงินต่อคน");

if(totalRed+totalBlue+amount>MAX_TABLE){
tableOpen=false;
return reply(event,"🛑 โต๊ะเต็ม AUTO");
}

const team=
bet[1]==="ด"?"แดง":"น้ำเงิน";

user.credit-=amount;
user.roundBet+=amount;

bets.push({
id:event.source.userId,
name:user.name,
team,
amount
});

team==="แดง"
?totalRed+=amount
:totalBlue+=amount;

return replyFlex(event);


// ========= RESULT =========
if(isAdmin && text==="/แดงชนะ"){
await payWinner("แดง");
return reply(event,"🏆 แดงชนะ จ่ายแล้ว");
}

if(isAdmin && text==="/น้ำเงินชนะ"){
await payWinner("น้ำเงิน");
return reply(event,"🏆 น้ำเงินชนะ จ่ายแล้ว");
}

}


// ================= PAY =================
async function payWinner(winner){

bets.forEach(b=>{

if(b.team===winner){

const user=users[b.id];

const rate=
winner==="แดง"
?rateRed
:rateBlue;

const win=
Math.floor(b.amount*rate/10);

user.credit+=b.amount+win;
}
});

tableOpen=false;
resetRound();
}


// ================= RESET =================
function resetRound(){

bets=[];
totalRed=0;
totalBlue=0;

Object.values(users)
.forEach(u=>u.roundBet=0);
}


// ================= FLEX =================
function replyFlex(event){

const ranking=
Object.values(users)
.filter(u=>u.roundBet>0)
.sort((a,b)=>b.roundBet-a.roundBet)
.slice(0,5)
.map((u,i)=>
`${i+1}. ${u.name} ${u.roundBet.toLocaleString()}`
).join("\n")||"-";

return client.replyMessage(
event.replyToken,{
type:"flex",
altText:"โต๊ะสด",
contents:{
type:"bubble",
body:{
type:"box",
layout:"vertical",
contents:[
{
type:"text",
text:"🔥 โต๊ะเดิมพัน LIVE",
weight:"bold",
size:"lg"
},
{
type:"text",
text:`🔴 ${totalRed.toLocaleString()}`
},
{
type:"text",
text:`🔵 ${totalBlue.toLocaleString()}`
},
{
type:"text",
text:`ราคา ${rateRed}/${rateBlue}`
},
{type:"separator"},
{
type:"text",
text:"🏆 อันดับนักแทง"
},
{
type:"text",
text:ranking
}
]
}
}
});
}


// ================= REPLY =================
function reply(event,text){
return client.replyMessage(
event.replyToken,
{type:"text",text}
);
}

app.listen(
process.env.PORT||3000,
()=>console.log("✅ BOT PRO MAX RUNNING")
);
