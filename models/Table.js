const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  open: { type:Boolean, default:false },

  rateRed:Number,
  rateBlue:Number,

  poolRed:{ type:Object, default:{} },
  poolBlue:{ type:Object, default:{} },

  bets:[
    {
      userId:String,
      name:String,
      side:String,
      amount:Number
    }
  ]
});

module.exports =
mongoose.model("Table",tableSchema);
