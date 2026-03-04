const mongoose=require("mongoose");

module.exports=mongoose.model("Bet",{
userId:String,
fightId:Number,
side:String,
amount:Number
});
