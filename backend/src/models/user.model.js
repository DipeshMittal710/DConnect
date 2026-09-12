import mongoose, { Schema } from "mongoose";

const userScheme = new Schema({
    name:             { type: String, required: true },
    username:         { type: String, required: true, unique: true },
    password:         { type: String, required: true },
    token:            { type: String, index: true },  // FIX: index for fast lookups
    tokenExpiry:      { type: Date },
    resetToken:       { type: String },               // #12: forgot password
    resetTokenExpiry: { type: Date },
});

const User = mongoose.model("User", userScheme);
export { User };