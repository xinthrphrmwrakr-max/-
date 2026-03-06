const mongoose = require("mongoose");

const FightSchema = new mongoose.Schema({

fightId:String,
red:String,
blue:String,

rateRed:String,
rateBlue:String,

status:{
type:String,
default:"open"
}

});

module.exports =
mongoose.model("Fight",FightSchema);
