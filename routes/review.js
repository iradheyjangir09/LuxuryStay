const express = require("express");
const mongoose = require("mongoose");

const router = express.Router({ mergeParams: true });

const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const { FALLBACK_MONGO_URL } = require("../config/db.js");
const { isLoggedIn, isReviewAuthor, validateReview } = require("../middleware.js");

const fallbackConnection = FALLBACK_MONGO_URL
    ? mongoose.createConnection(FALLBACK_MONGO_URL, { serverSelectionTimeoutMS: 2000 })
    : null;
const FallbackListing = fallbackConnection ? fallbackConnection.model("Listing", Listing.schema) : null;
const FallbackReview = fallbackConnection ? fallbackConnection.model("Review", Review.schema) : null;

if (fallbackConnection) {
    fallbackConnection.on("error", (err) => {
        console.log("Fallback DB connection error", err.message);
    });
}

function buildReviewSnapshot(reviewDoc) {
    return {
        reviewId: reviewDoc._id,
        authorName: reviewDoc.authorName,
        comment: reviewDoc.comment,
        rating: reviewDoc.rating,
        createdAt: reviewDoc.createdAt
    };
}

router.post("/", isLoggedIn, validateReview, wrapAsync(async (req, res) => {
    if (!req.body.review) {
        throw new ExpressError(400, "Review data is required!");
    }

    const listingId = req.params.id.trim();

    // 1. पैलां Review ऑब्जेक्ट बणाओ
    const newReview = new Review({
        comment: req.body.review.comment,
        rating: Number(req.body.review.rating),
        authorName: req.user.username,
        author: req.user._id // अठै author जोड़ दियो
    });

    await newReview.save();

    // 2. Primary DB में अपडेट करण की कोसिस
    let listing = await Listing.findByIdAndUpdate(
        listingId,
        {
            $push: {
                reviews: newReview._id,
                reviewSnapshots: buildReviewSnapshot(newReview)
            }
        },
        { returnDocument: "after" }
    );

    if (listing) {
        return res.redirect(`/listings/${listing._id}`);
    }

    if (!FallbackListing || !FallbackReview) {
        await Review.findByIdAndDelete(newReview._id);
        throw new ExpressError(404, "Listing not found!");
    }

    // 3. जे Primary में कोनी मिल्यो तो Fallback DB चेक करो
    const fallbackReview = new FallbackReview({
        comment: req.body.review.comment,
        rating: Number(req.body.review.rating),
        authorName: req.user.username,
        author: req.user._id
    });

    await fallbackReview.save();
    
    listing = await FallbackListing.findByIdAndUpdate(
        listingId,
        {
            $push: {
                reviews: fallbackReview._id,
                reviewSnapshots: buildReviewSnapshot(fallbackReview)
            }
        },
        { returnDocument: "after" }
    );

    if (!listing) {
        // जे कठै ई कोनी मिल्यो तो बणायाड़ा रिव्यू डिलीट करो
        await Review.findByIdAndDelete(newReview._id);
        await FallbackReview.findByIdAndDelete(fallbackReview._id);
        throw new ExpressError(404, "Listing not found!");
    }

    // फालतू प्राइमरी रिव्यू हटाओ क्यूंकि डेटा Fallback में गयो है
    await Review.findByIdAndDelete(newReview._id);

    res.redirect(`/listings/${listing._id}`);
}));

// DELETE Route में reviewId चेक करण को तरीको सही करयो है
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(async (req, res) => {
    const { id, reviewId } = req.params;

    let listing = await Listing.findByIdAndUpdate(id, {
        $pull: {
            reviews: reviewId,
            reviewSnapshots: { reviewId: new mongoose.Types.ObjectId(reviewId) }
        }
    });

    if (listing) {
        await Review.findByIdAndDelete(reviewId);
        return res.redirect(`/listings/${id}`);
    }

    if (FallbackListing && FallbackReview) {
        listing = await FallbackListing.findByIdAndUpdate(id, {
            $pull: {
                reviews: reviewId,
                reviewSnapshots: { reviewId: new mongoose.Types.ObjectId(reviewId) }
            }
        });

        if (listing) {
            await FallbackReview.findByIdAndDelete(reviewId);
            return res.redirect(`/listings/${id}`);
        }
    }

    throw new ExpressError(404, "Listing not found!");
}));

module.exports = router;
