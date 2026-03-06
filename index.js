require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const mongoose = require("mongoose");

const app = express();

const config = {
 channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
 channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected"));

/* ================= DATABASE ================= */

const User = mongoose.model("User",{
 userId:String,
 name:String,
 credit:{type:Number,default:0}
});

const Bet = mongoose.model("Bet",{
 userId:String,
 name:String,
 side:String,
 amount:Number
});

const Table = mongoose.model("Table",{
 status:String,
 red:String,
 blue:String,
 limit:Number,
 total:{type:Number,default:0}
});

/* ================= WEBHOOK ================= */

app.post("/webhook",line.middleware(config),(req,res)=>{
 Promise.all(req.body.events.map(handleEvent))
 .then(()=>res.json({status:"ok"}))
 .catch(()=>res.status(200).end());
});

/* ================= EVENT ================= */

async function handleEvent(event){

if(event.type!="message") return;
if(event.message.type!="text") return;

const msg = event.message.text.trim();
const uid = event.source.userId;

let user = await User.findOne({userId:uid});

if(msg === "C"){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text:"เช็คเครดิต"
  });
}

if(msg === "ด500"){
  return client.replyMessage(event.replyToken,{
    type:"text",
    text:"แทง ด 500 สำเร็จ"
  });
}

return client.replyMessage(event.replyToken,{
  type:"text",
  text:"บอททำงานแล้ว"
});

}

 /* ===== สมัคร ===== */

 if(msg==="สมัคร"){

 const profile = await client.getProfile(uid);

 if(!user){

 user = await User.create({
 userId:uid,
 name:profile.displayName
 });

 return reply(event,
`สมัครสำเร็จ
${profile.displayName}
เครดิต 0`);

 }

 return reply(event,"สมัครแล้ว");
 }

 /* ===== เครดิต ===== */

 if(msg==="C"){

 if(!user) return reply(event,"พิมพ์ สมัคร ก่อน");

 const mybets = await Bet.find({userId:uid});

 let text=`เครดิต ${user.credit}\n\nบิลคุณ\n`;

 mybets.forEach(b=>{
 text+=`${b.side}${b.amount}\n`;
 });

 return reply(event,text);
 }

 /* ===== แทง ===== */

 if(/^[ดง]\d+$/i.test(msg)){

 if(!user) return reply(event,"สมัครก่อน");

 const table = await Table.findOne({status:"open"});

 if(!table) return reply(event,"❌ ปิดรับ");

 const side = msg[0];
 const money = Number(msg.slice(1));

 if(user.credit < money)
 return reply(event,"เงินไม่พอ");

 if(table.total + money > table.limit)
 return reply(event,"ราคานี้เต็ม");

 user.credit -= money;
 await user.save();

 table.total += money;
 await table.save();

 await Bet.create({
 userId:uid,
 name:user.name,
 side,
 amount:money
 });

 const text =
 side==="ด"
 ?`${user.name} ต่อ ด${money}`
 :`${user.name} รอง ง${money}`;

 return reply(event,text);

 }

 /* ===== เติม ===== */

 if(msg.startsWith("เติม")){

 const money = msg.split(" ")[1];

 return reply(event,
`แจ้งเติม ${money}
รอแอดมินตรวจสอบ`);
 }

}

/* ================= ADMIN ================= */

app.post("/admin",(req,res)=>{

 const msg=req.body.msg;

});

/* ===== เปิดราคา ===== */

async function openTable(red,blue,limit){

 await Table.deleteMany({});

 await Table.create({
 status:"open",
 red,
 blue,
 limit
 });

}

/* ===== ปิดราคา ===== */

async function closeTable(){

 await Table.updateOne(
 {status:"open"},
 {status:"close"}
 );

}

/* ===== จบคู่ ===== */

async function finishTable(){

 const bets = await Bet.find({});

 let text="สรุปบิล\n\n";

 bets.forEach(b=>{
 text+=`${b.name} ${b.side}${b.amount}\n`;
 });

 await Bet.deleteMany({});
 await Table.deleteMany({});

 return text;

}

/* ================= HELPER ================= */

function reply(event,text){

 return client.replyMessage(event.replyToken,{
 type:"text",
 text
 });

}

app.get("/",(req,res)=>{
 res.send("BOT RUNNING");
});

const port = process.env.PORT || 3000;
app.listen(port,()=>console.log("Server "+port));
