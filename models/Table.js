const mongoose=require("mongoose");

module.exports=mongoose.model(
"Table",
new mongoose.Schema({
open:Boolean,
rateRed:String,
rateBlue:String,
limit:Number,
bets:Array
})
);
