const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  tableId: String,
  rateRed: Number,
  rateBlue: Number,
  totalRed: { type: Number, default: 0 },
  totalBlue: { type: Number, default: 0 },
  status: { type: String, default: "open" },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports =
mongoose.model("Table", tableSchema);
