const mongoose = require("mongoose");

const fightSchema = new mongoose.Schema({
  teamA:String,
  teamB:String,

  status:{
    type:String,
    default:"open"
  },

  prices:[
    {
      priceNo:Number,
      ต่อ:Number,
      รอง:Number,
      createdAt:{
        type:Date,
        default:Date.now
      }
    }
  ]
});

module.exports = mongoose.model("Fight",fightSchema);
