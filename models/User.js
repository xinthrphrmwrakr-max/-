const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  userId: String,
  name: String,
  credit: {
    type: Number,
    default: 20000
  },
  roundBet: {
    type: Number,
    default: 0
  }
});

module.exports =
mongoose.model("User", UserSchema);
