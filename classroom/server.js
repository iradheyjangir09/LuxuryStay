const express = require("express");
const app = express();
const path = require("path"); // पाथ मॉड्यूल जोड़ दियो
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash"); // फ्लैश खातर

const users = require("./routes/user.js");
const posts = require("./routes/post.js");
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SECRET || process.env.SESSION_SECRET || "development-session-secret";

// View Engine सेटअप
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// मिडिलवेयर
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

app.use(flash()); // फ्लैश मिडिलवेयर चालू कर्यो

// फ्लैश मैसेज लोकल वेरिएबल्स में सेट करण खातर (Optional)
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  next();
});

// --- रूट्स ---

app.get("/", (req, res) => {
    res.send("राम राम, मैं रूट हूँ!");
});

// Signed Cookies
app.get("/getsignedcookies", (req, res) => {
  res.cookie("name", "Jangir", { signed: true })
     .cookie("age", "30", { signed: true })
     .send("साइन की हुई कुकीज भेज दी गई है");
});

app.get("/verifysignedcookies", (req, res) => {
  console.log("साइन की हुई कुकीज: ", req.signedCookies);
  res.send(req.signedCookies);
});

// Session Count
app.get("/reqcount", (req, res) => {
  req.session.count = (req.session.count || 0) + 1;
  res.send(`थै ${req.session.count} बार रिक्वेस्ट भेजी है`);
});

// Flash & Redirect
app.get("/register", (req, res) => {
  let { name = "anonymous" } = req.query;
  req.session.name = name;
  req.flash("success", "यूजर सफलतापूर्वक रजिस्टर होग्यो!");
  res.redirect("/hello");
});

app.get("/hello", (req, res) => {
  let name = (req.session && req.session.name) ? req.session.name : "Guest";
  
  res.send(`hello ${name}. सन्देश: ${req.flash("success")}`);
});

// Router Middlewares
app.use("/users", users);
app.use("/posts", posts);

// 404 Error
app.use((req, res) => {
    res.status(404).send("पेज कोनी मिल्यो!");
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`सर्वर पोर्ट ${PORT} पर चाल रह्यो है... http://localhost:${PORT}`);
    });
}

module.exports = app;
