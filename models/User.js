const mongoose=require("mongoose");

module.exports=mongoose.model("User",{
userId:String,
credit:{type:Number,default:0}
});
