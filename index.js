require('dotenv').config();

const express=require("express");
const line=require("@line/bot-sdk");
const mongoose=require("mongoose");

const User=require("./models/User");
const Table=require("./models/Table");
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

const ADMIN="U3bb879084521bbe454c63a2fb7d56c64";
const GROUP_ID="GROUP_ID";


// ================= TABLE =================
async function getTable(){
let t=await Table.findOne();

if(!t){
t=await Table.create({
open:false,
poolRed:{},
poolBlue:{},
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
Promise.all(req.body.events.map(handleEvent));
res.sendStatus(200);
});


// ================= MAIN =================
async function handleEvent(event){

if(event.type!=="message")return;
if(event.message.type!=="text")return;

const text=event.message.text.trim();

const profile=
await client.getProfile(event.source.userId);

const user=
await getUser(
event.source.userId,
profile.displayName
);

const table=await getTable();

const isAdmin=
event.source.userId===ADMIN;


// ========= CREDIT =========
if(text.toLowerCase()==="c"){
return reply(event,
`${user.name}
💰 เครดิต ${user.credit}`
);
}


// ========= ADMIN เติม =========
if(isAdmin && text.startsWith("/เติม")){

const amount=parseInt(text.split(" ")[1]);

user.credit+=amount;
await user.save();

return reply(event,
`✅ เติม ${amount}
💰 ${user.credit}`
);
}


// ========= ADMIN หัก =========
if(isAdmin && text.startsWith("/หัก")){

const amount=parseInt(text.split(" ")[1]);

user.credit-=amount;
await user.save();

return reply(event,
`❌ หัก ${amount}
💰 ${user.credit}`
);
}


// ========= OPEN =========
if(isAdmin && text.startsWith("/เปิดโต๊ะ")){

const sp=text.split(" ");

table.open=true;
table.rateRed=parseInt(sp[1]);
table.rateBlue=parseInt(sp[2]);

table.poolRed={};
table.poolBlue={};
table.bets=[];

await table.save();

return pushFlex();
}


// ========= CLOSE =========
if(isAdmin && text==="/ปิดโต๊ะ"){
table.open=false;
await table.save();
return pushText("🚫 ปิดรับแทง");
}


// ========= BET =========
const bet=text.match(/^(ด|ง)(\d+)/);

if(bet){

if(!table.open)
return reply(event,"❌ โต๊ะปิด");

const side=
bet[1]=="ด"?"red":"blue";

const amount=parseInt(bet[2]);

if(user.credit<amount)
return reply(event,"เงินไม่พอ");

user.credit-=amount;
await user.save();

table.bets.push({
userId:user.userId,
name:user.name,
side,
amount
});

await table.save();

return pushFlex();
}


// ========= RESULT =========
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
await User.findOne({
userId:b.userId
});

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

let rank={};

t.bets.forEach(b=>{
rank[b.name]=(rank[b.name]||0)+b.amount;
});

const top=
Object.entries(rank)
.sort((a,b)=>b[1]-a[1])
.slice(0,3)
.map((r,i)=>`${i+1}. ${r[0]} ${r[1]}`)
.join("\n")||"-";

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
text:"🔥 สายใต้ไก่เดือย",
weight:"bold",
size:"xl",
align:"center",
color:"#ff3b3b"
},
{
type:"separator",
margin:"md"
},
{
type:"text",
text:`🏆 อันดับคนแทง\n${top}`,
margin:"md"
}
]


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

app.listen(3000,
()=>console.log("🚀 BOT V6 RUNNING"));
