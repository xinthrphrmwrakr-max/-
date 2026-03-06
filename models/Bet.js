const mongoose=require("mongoose");

const BetSchema=new mongoose.Schema({

userId:String,
name:String,

fightId:String,

side:String,
amount:Number

});

module.exports=
mongoose.model("Bet",BetSchema);
