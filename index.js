require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.json({ status: "ok" }))
    .catch((err) => {
      console.log(err);
      res.status(200).end();
    });
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const msg = event.message.text;

  if (msg === "C") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "แทง C เรียบร้อย"
    });
  }

  if (msg === "B") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "แทง B เรียบร้อย"
    });
  }

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: "พิมพ์ C หรือ B เพื่อแทง"
  });
}

app.get("/", (req, res) => {
  res.send("BOT RUNNING");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running " + port);
});
