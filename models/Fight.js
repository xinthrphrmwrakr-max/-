const mongoose=require("mongoose");

module.exports=mongoose.model("Fight",{
fightId:Number,
red:String,
blue:String,
rateRed:String,
rateBlue:String,
status:String
});
