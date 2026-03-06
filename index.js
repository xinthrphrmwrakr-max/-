require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const mongoose = require("mongoose");

const app = express();

/* LINE CONFIG */
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

/* CONNECT MONGODB */
mongoose.connect(process.env.MONGO_URI)
.then(()=>{
  console.log("MongoDB Connected");
})
.catch(err=>{
  console.log(err);
});

/* WEBHOOK */
app.post("/webhook", line.middleware(config), async (req,res)=>{
  try{
    const events = req.body.events;

    for(const event of events){

      if(event.type !== "message") continue;
      if(event.message.type !== "text") continue;

      const msg = event.message.text.trim();

      /* แทง */
      if(msg.startsWith("ด") || msg.startsWith("ง")){
        await client.replyMessage(event.replyToken,{
          type:"text",
          text:"รับเดิมพัน "+msg+" แล้ว"
        });
        continue;
      }

      /* เช็คเครดิต */
      if(msg === "C"){
        await client.replyMessage(event.replyToken,{
          type:"text",
          text:"เครดิตของคุณ 1000"
        });
        continue;
      }

      /* default */
      await client.replyMessage(event.replyToken,{
        type:"text",
        text:"พิมพ์ ด500 / ง500 เพื่อเดิมพัน"
      });

    }

    res.status(200).end();

  }catch(err){
    console.log(err);
    res.status(200).end();
  }
});

/* TEST SERVER */
app.get("/",(req,res)=>{
  res.send("BOT RUNNING");
});

const port = process.env.PORT || 3000;

app.listen(port,()=>{
  console.log("Server "+port);
});
