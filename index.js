require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const mongoose = require("mongoose");

const User = require("./models/User");
const Bet = require("./models/Bet");
const Table = require("./models/Table");

const app = express();

const config = {
 channelAccessToken:process.env.CHANNEL_ACCESS_TOKEN,
 channelSecret:process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected"));

app.post("/webhook",line.middleware(config),(req,res)=>{
 Promise.all(req.body.events.map(handleEvent))
 .then(()=>res.json({status:"ok"}))
 .catch(()=>res.status(200).end());
});

async function handleEvent(event){

 if(event.type!=="message") return;
 if(event.message.type!=="text") return;

 const msg = event.message.text.trim();
 const uid = event.source.userId;

 let user = await User.findOne({userId:uid});

 if(!user){
  user = await User.create({
   userId:uid,
   name:"สมาชิก",
   credit:0
  });
 }

 const table = await Table.findOne({});

 // เช็คเครดิต
 if(msg==="C"){
  const bets = await Bet.find({userId:uid});
  
  let text = "เครดิต: "+user.credit+"\n";

  bets.forEach(b=>{
   text += `${b.side}${b.amount} ราคา ${b.price}\n`;
  });

  return client.replyMessage(event.replyToken,{
   type:"text",
   text
  });
 }

 // เติมเครดิต (แอดมิน)
 if(msg.startsWith("เติม")){
  if(uid!==process.env.ADMIN_ID) return;

  const amount = parseInt(msg.split(" ")[1]);

  user.credit += amount;
  await user.save();

  return client.replyMessage(event.replyToken,{
   type:"text",
   text:"เติมเครดิต "+amount
  });
 }

 // เปิดราคา
 if(msg.startsWith("เปิด")){
  if(uid!==process.env.ADMIN_ID) return;

  const price = msg.split(" ")[1];
  const max = parseInt(msg.split(" ")[2]);

  await Table.deleteMany({});

  await Table.create({
   round:Date.now(),
   open:true,
   price,
   maxBet:max
  });

  return client.replyMessage(event.replyToken,flexOpen(price,max));
 }

 // ปิดราคา
 if(msg==="ปิด"){
  if(uid!==process.env.ADMIN_ID) return;

  const t = await Table.findOne();
  t.open=false;
  await t.save();

  return client.replyMessage(event.replyToken,{
   type:"text",
   text:"ปิดราคาแล้ว"
  });
 }

 // ปิดโต๊ะ
 if(msg==="ปิดโต๊ะ"){
  if(uid!==process.env.ADMIN_ID) return;

  const bets = await Bet.find({});
  let text="สรุปบิล\n";

  bets.forEach(b=>{
   text+=`${b.side}${b.amount}\n`;
  });

  await Bet.deleteMany({});

  return client.replyMessage(event.replyToken,{
   type:"text",
   text
  });
 }

 // แทง ด500 ง300
 if(msg.match(/^[ดง]\d+/)){

  if(!table || !table.open){
   return client.replyMessage(event.replyToken,{
    type:"text",
    text:"ราคาปิด"
   });
  }

  const side = msg[0];
  const amount = parseInt(msg.substring(1));

  if(user.credit < amount){
   return client.replyMessage(event.replyToken,{
    type:"text",
    text:"เครดิตไม่พอ"
   });
  }

  if(table.totalBet + amount > table.maxBet){
   table.open=false;
   await table.save();

   return client.replyMessage(event.replyToken,{
    type:"text",
    text:"ยอดเต็ม ปิดราคา"
   });
  }

  user.credit -= amount;
  await user.save();

  table.totalBet += amount;
  await table.save();

  await Bet.create({
   userId:uid,
   side,
   amount,
   price:table.price,
   round:table.round
  });

  return client.replyMessage(event.replyToken,{
   type:"text",
   text:`แทง ${side}${amount} สำเร็จ`
  });
 }

}

function flexOpen(price,max){

 return {
 type:"flex",
 altText:"เปิดราคา",
 contents:{
  type:"bubble",
  body:{
   type:"box",
   layout:"vertical",
   contents:[
    {
     type:"text",
     text:"🐔 เปิดราคา"
    },
    {
     type:"text",
     text:`ราคา ${price}`
    },
    {
     type:"text",
     text:`รับสูงสุด ${max}`
    }
   ]
  }
 }
};

}

app.get("/",(req,res)=>res.send("BOT RUNNING"));

const port = process.env.PORT || 3000;

app.listen(port,()=>console.log("Server "+port));
