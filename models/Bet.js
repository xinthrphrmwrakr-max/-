const mongoose = require("mongoose");

const BetSchema = new mongoose.Schema({
  userId: String,
  name: String,
  team: String,
  amount: Number,
  rate: Number,
  round: Number
});

module.exports =
mongoose.model("Bet", BetSchema);
