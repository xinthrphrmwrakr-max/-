const express=require("express");
const line=require("@line/bot-sdk");
const mongoose=require("mongoose");

const User=require("./models/User");
const Table=require("./models/Table");

const app=express();

const config={
channelAccessToken:"rULcYwAsV4CS7pD4hWcQvNTvxt3wHIXGjVUfCQFN6rYJkn49wc2jG8EPaqJxJToqmETEO04/zAjuu4RojiWR/SRZFzTBMpQEeBpgYQbDJ2Sr63x4Ia2wu8vfSR9dkgZyur7SI4f56PN0LHSuen+EpwdB04t89/1O/w1cDnyilFU=",
channelSecret:"5bd5a4a0980d497b71e4eae7d217d1cf"
};

const client=new line.Client(config);

require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Mongo Connected"))
.catch(err => console.log(err));

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
name
});
}

return u;
}


// ================= WEBHOOK =================
app.post(
"/webhook",
line.middleware(config),
(req,res)=>{
Promise.all(
req.body.events.map(handleEvent)
);
res.sendStatus(200);
}
);


// ================= MAIN =================
async function handleEvent(event){

if(event.type!=="message")return;
if(event.message.type!=="text")return;

const text=event.message.text.trim();

const profile=
await client.getProfile(
event.source.userId
);

const user=
await getUser(
event.source.userId,
profile.displayName
);

const table=
await getTable();

const isAdmin=
event.source.userId===ADMIN;


// ========= CREDIT =========
if(text.toLowerCase()==="c"){
return reply(event,
`${user.name}
💰 ${user.credit.toLocaleString()}`
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

const pool=
side=="red"
?table.poolRed
:table.poolBlue;

const rate=
side=="red"
?table.rateRed
:table.rateBlue;

if(!pool[rate])
pool[rate]=0;

pool[rate]+=amount;

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
await table.save();
}


// ================= FLEX =================
async function pushFlex(){

const t=await getTable();

const red=
Object.entries(t.poolRed)
.map(([r,v])=>`${r} = ${v}`)
.join("\n")||"-";

const blue=
Object.entries(t.poolBlue)
.map(([r,v])=>`${r} = ${v}`)
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
text:"🔥 บุญเท่ง ไก่ใต้",
weight:"bold"
},
{
type:"text",
text:`🔴\n${red}`
},
{
type:"separator"
},
{
type:"text",
text:`🔵\n${blue}`
}
]
}
}
});
}


// ================= PUSH TEXT =================
function pushText(msg){
return client.pushMessage(
GROUP_ID,
{type:"text",text:msg}
);
}


// ================= REPLY =================
function reply(event,text){
return client.replyMessage(
event.replyToken,
{type:"text",text}
);
}


app.listen(3000,
()=>console.log("✅ V4 REAL TABLE RUNNING")
);
