require("dotenv").config();

const express=require("express");
const line=require("@line/bot-sdk");
const mongoose=require("mongoose");

const User=require("./models/User");
const Table=require("./models/Table");

const app=express();

const config={
channelAccessToken:process.env.CHANNEL_ACCESS_TOKEN,
channelSecret:process.env.CHANNEL_SECRET
};

const client=new line.Client(config);

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ Mongo Connected"));

const ADMIN="U3bb879084521bbe454c63a2fb7d56c64";
const GROUP_ID="Cbe4b98d3adcc05e91341e544ef99ba5d";


// ================= TABLE =================
async function getTable(){

let t=await Table.findOne();

if(!t){
t=await Table.create({
open:false,
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
.catch(()=>res.sendStatus(500));
});


// ================= MAIN =================
async function handleEvent(event){

if(event.type!=="message")return;
if(event.message.type!=="text")return;

if(
event.source.type==="group" &&
event.source.groupId!==GROUP_ID
)return;

const text=event.message.text.trim();


// ===== SAFE PROFILE =====
let name="User";

try{
const p=await client.getGroupMemberProfile(
event.source.groupId,
event.source.userId
);
name=p.displayName;
}catch{}

const user=await getUser(event.source.userId,name);
const table=await getTable();

const isAdmin=event.source.userId===ADMIN;


// ================= CREDIT =================
if(text==="c")
return reply(event,
`${user.name}\n💰 ${user.credit}`);


// ================= OPEN =================
if(isAdmin && text.startsWith("/เปิดโต๊ะ")){

const sp=text.split(" ");

table.open=true;
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
const bet=text.match(/^(ด|ง)(\d+)$/);

if(bet){

if(!table.open)
return reply(event,"โต๊ะปิด");

const side=bet[1]=="ด"?"red":"blue";
const amount=parseInt(bet[2]);

if(user.credit<amount)
return reply(event,"เงินไม่พอ");

const total=
table.bets
.filter(b=>b.side===side)
.reduce((s,b)=>s+b.amount,0);

if(total+amount>table.limit)
return reply(event,"เต็ม");

user.credit-=amount;
await user.save();

const old=
table.bets.find(
b=>b.userId===user.userId &&
b.side===side
);

if(old) old.amount+=amount;
else table.bets.push({
userId:user.userId,
name:user.name,
side,
amount
});

await table.save();

return pushFlex();
}


// ================= BILL =================
if(text==="บิล"){

const my=
table.bets.filter(
b=>b.userId===user.userId
);

if(!my.length)
return reply(event,"ไม่มีบิล");

let msg="🎫 บิล\n";

my.forEach(b=>{
msg+=`${b.side==="red"?"🔴":"🔵"} ${b.amount}\n`;
});

return reply(event,msg);
}


// ================= CANCEL =================
if(text==="ยกเลิก"){

if(!table.open)
return reply(event,"โต๊ะปิด");

let refund=0;

table.bets=
table.bets.filter(b=>{
if(b.userId===user.userId){
refund+=b.amount;
return false;
}
return true;
});

user.credit+=refund;

await user.save();
await table.save();

pushFlex();

return reply(event,
`คืน ${refund}`);
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


// ================= SUMMARY =================
if(isAdmin && text==="/สรุป"){

let msg="📊 สรุป\n";

table.bets.forEach(b=>{
msg+=`${b.name}
${b.side==="red"?"🔴":"🔵"} ${b.amount}\n`;
});

return pushText(msg||"ไม่มี");
}


// ================= RESET =================
if(isAdmin && text==="/reset"){

table.open=false;
table.bets=[];

await table.save();

return pushText("♻️ RESET");
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
if(b.side==="red")red+=b.amount;
if(b.side==="blue")blue+=b.amount;
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
text:"🔥 LIVE TABLE",
weight:"bold",
size:"xl",
align:"center"
},
{
type:"text",
text:`🔴 ${red}/${t.limit}`
},
{
type:"text",
text:`🔵 ${blue}/${t.limit}`
},
{
type:"text",
text:`รวม ${red+blue}`,
weight:"bold"
}
]
}
}
});
}


// ================= PUSH =================
function pushText(msg){
return client.pushMessage(
GROUP_ID,{type:"text",text:msg});
}

function reply(event,text){
return client.replyMessage(
event.replyToken,
{type:"text",text});
}

app.listen(3000,
()=>console.log("🚀 V9 RUNNING"));
