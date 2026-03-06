require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

/* LINE CONFIG */
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

app.post("/webhook", line.middleware(config), async (req,res)=>{

try{

const events = req.body.events;

for(const event of events){

if(event.type !== "message") continue;
if(event.message.type !== "text") continue;

const uid = event.source.userId;

console.log("USER ID:",uid);

}

res.sendStatus(200);

}catch(err){

console.log(err);
res.sendStatus(500);

}

});

app.get("/",(req,res)=>{
res.send("BOT RUNNING");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
console.log("Server running "+PORT);
});
