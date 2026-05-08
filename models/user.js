const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
});

userSchema.virtual("isAdmin").get(function () {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    return Boolean(this.email && adminEmails.includes(this.email.toLowerCase()));
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
