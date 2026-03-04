require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const mongoose = require("mongoose");

const User = require("./models/User");
const Table = require("./models/Table");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ Mongo Connected"))
.catch(err=>console.log(err));


// ================= CONFIG =================
const ADMIN="U3bb879084521bbe454c63a2fb7d56c64";
const GROUP_ID="Cbe4b98d3adcc05e91341e544ef99ba5d";


// ================= TABLE =================
async function getTable(){

let t=await Table.findOne();

if(!t){
t=await Table.create({
open:false,
rateRed:0,
rateBlue:0,
limit:0,
bets:[]
});
}

return t;
}


// ================= USER =================
async function getUser(id,name){

let u=await User.findOne({userId:id});

if(!u){
u=await User.create({
userId:id,
name,
credit:0
});
}

return u;
}


// ================= WEBHOOK =================
app.post("/webhook",
line.middleware(config),
(req,res)=>{

Promise
.all(req.body.events.map(handleEvent))
.then(()=>res.sendStatus(200))
.catch(err=>{
console.error(err);
res.sendStatus(500);
});

});


// ================= MAIN =================
async function handleEvent(event){

if(event.type!=="message") return;
if(event.message.type!=="text") return;

// ✅ ทำงานเฉพาะกลุ่มนี้
if(
event.source.type==="group" &&
event.source.groupId!==GROUP_ID
)return;

const text=event.message.text.trim();


// ===== SAFE PROFILE =====
let name="User";

try{
if(event.source.type==="group"){
const p=await client.getGroupMemberProfile(
event.source.groupId,
event.source.userId
);
name=p.displayName;
}else{
const p=await client.getProfile(
event.source.userId
);
name=p.displayName;
}
}catch{}


// ===== USER =====
const user=
await getUser(
event.source.userId,
name
);

const table=await getTable();

const isAdmin=
event.source.userId===ADMIN;


// ================= CREDIT =================
if(text.toLowerCase()==="c"){
return reply(event,
`${user.name}
💰 เครดิต ${user.credit}`);
}


// ================= เติม =================
if(isAdmin && text.startsWith("/เติม")){

const sp=text.split(" ");

if(sp.length<3)
return reply(event,"ใช้: /เติม USERID จำนวน");

const target=
await User.findOne({userId:sp[1]});

if(!target)
return reply(event,"ไม่พบ USER");

const amount=parseInt(sp[2]);

target.credit+=amount;
await target.save();

return pushText(
`✅ เติม ${amount} ให้ ${target.name}`
);
}


// ================= OPEN =================
if(isAdmin && text.startsWith("/เปิดโต๊ะ")){

const sp=text.split(" ");

table.open=true;
table.rateRed=sp[1];
table.rateBlue=sp[2];
table.limit=parseInt(sp[3]);

table.bets=[];

await table.save();

return pushFlex();
}


// ================= CLOSE =================
if(isAdmin && text==="/ปิดโต๊ะ"){
table.open=false;
await table.save();
return pushText("🚫 ปิดรับแทง");
}


// ================= BET =================
const bet=text.match(/^(ด|ง)\s*(\d+)$/);

if(bet){

if(!table.open)
return reply(event,"❌ โต๊ะปิด");

const side=
bet[1]=="ด"?"red":"blue";

const amount=parseInt(bet[2]);

if(user.credit<amount)
return reply(event,"เงินไม่พอ");


// ✅ ตรวจ limit
const totalSide=
table.bets
.filter(b=>b.side===side)
.reduce((s,b)=>s+b.amount,0);

if(totalSide+amount>table.limit)
return reply(event,"❌ ราคานี้เต็ม");


// ✅ หักเงิน
user.credit-=amount;
await user.save();


// ✅ รวมบิลเดิม
const old=
table.bets.find(
b=>b.userId===user.userId &&
b.side===side
);

if(old){
old.amount+=amount;
}else{
table.bets.push({
userId:user.userId,
name:user.name,
side,
amount
});
}

await table.save();

return pushFlex();
}


// ================= RESULT =================
if(isAdmin && text==="/แดงชนะ"){
await payWinner("red");
return pushText("🏆 แดงชนะ");
}

if(isAdmin && text==="/น้ำเงินชนะ"){
await payWinner("blue");
return pushText("🏆 น้ำเงินชนะ");
}

}


// ================= PAY =================
async function payWinner(win){

const table=await getTable();

for(const b of table.bets){

if(b.side===win){

const u=
await User.findOne({userId:b.userId});

u.credit+=b.amount*2;
await u.save();
}
}

table.open=false;
table.bets=[];
await table.save();
}


// ================= FLEX =================
async function pushFlex(){

const t=await getTable();

let red=0;
let blue=0;

t.bets.forEach(b=>{
if(b.side==="red") red+=b.amount;
if(b.side==="blue") blue+=b.amount;
});

return client.pushMessage(
GROUP_ID,{
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
text:"🔥 สายใต้ไก่เดือย",
weight:"bold",
size:"xl",
align:"center"
},
{
type:"text",
text:`🔴 ${red}/${t.limit}`,
margin:"md"
},
{
type:"text",
text:`🔵 ${blue}/${t.limit}`
},
{
type:"text",
text:`รวม ${red+blue}`,
weight:"bold",
margin:"md"
}
]
}
}
});
}


// ================= PUSH =================
function pushText(msg){
return client.pushMessage(
GROUP_ID,
{type:"text",text:msg}
);
}

function reply(event,text){
return client.replyMessage(
event.replyToken,
{type:"text",text}
);
}


// ================= SERVER =================
app.listen(3000,
()=>console.log("🚀 BOT FINAL RUNNING"));
