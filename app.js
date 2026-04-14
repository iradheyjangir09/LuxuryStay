const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");

const mongourl = "mongodb://127.0.0.1:27017/dataji";


main()
    .then(() => {
        console.log("database saag kr lio an (Connected to DB)");
    })
    .catch((err) => {
        console.log("Connection Error: ", err);
    });

async function main() {
    await mongoose.connect(mongourl);
}


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));

// --- ROUTES (क्रम बहुत जरूरी है!) ---

// 1. होम रूट (Home)
app.get("/", (req, res) => {
    res.send("Hi, I am root! Server एकदम टकाटक चाल रयो है।");
});

// 2. इंडेक्स रूट (Index Route) - सारी लिस्टिंग्स देखण खातर
app.get("/listings", async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
});

// 3. नयो फॉर्म दिखाण आळी रूट (New Route)
// *** इणने :id आळी रूट स्यूं ऊपर राखणी पड़ेगी ***
app.get("/listings/new", (req, res) => {
    res.render("listings/new.ejs");
});

// 4. नयो डेटा सेव करण खातर (Create Route)
app.post("/listings", async (req, res) => {
    try {
        const newListing = new Listing(req.body.listing);
        await newListing.save();
        res.redirect("/listings");
    } catch (err) {
        console.log(err);
        res.status(500).send("डेटा सेव कोनी हुयो!");
    }
});

// 5. एडिट फॉर्म दिखाण खातर (Edit Route)
// *** यो भी :id वाली शो रूट स्यूं ऊपर ही सही रहेवे है ***
app.get("/listings/:id/edit", async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/edit.ejs", { listing });
});

// 6. डेटा अपडेट करण खातर (Update Route)
app.post("/listings/:id", async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    res.redirect(`/listings/${id}`);
});

// 7. शो रूट (Show Route) - एक सिंगल लिस्टिंग देखण खातर
// *** इणने सबस्यूं नीचे राखो, ताकि 'new' और 'edit' ने ID न समझ ले ***
app.get("/listings/:id", async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/show.ejs", { listing });
});

// 3. सर्वर चालू
const port = 8080;
app.listen(port, () => {
    console.log(`Server live: http://localhost:${port}`);
});

const serverless = require('serverless-http');

// सारा पुराना रूट्स (get, post) इयां ही रहण द्यो

module.exports.handler = serverless(app);