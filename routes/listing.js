const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const util = require("util");

const wrapAsync = require("../utils/wrapAsync.js");
const { listingSchema } = require("../schema.js");
const ExpressError = require("../utils/ExpressError.js");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const { isLoggedIn, isOwner } = require("../middleware.js");
const { FALLBACK_MONGO_URL } = require("../config/db.js");
const { cloudinary, hasCloudinaryConfig } = require("../config/cloudinary.js");

const fallbackConnection = FALLBACK_MONGO_URL
    ? mongoose.createConnection(FALLBACK_MONGO_URL, { serverSelectionTimeoutMS: 2000 })
    : null;
const FallbackListing = fallbackConnection ? fallbackConnection.model("Listing", Listing.schema) : null;
const FallbackReview = fallbackConnection ? fallbackConnection.model("Review", Review.schema) : null;
const FallbackUser = fallbackConnection ? fallbackConnection.model("User", User.schema) : null;

if (fallbackConnection) {
    fallbackConnection.on("error", (err) => {
        console.log("Fallback DB connection error", err.message);
    });
}

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const removeFile = util.promisify(fs.unlink);

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const safeName = path.basename(file.originalname).replace(/\s+/g, "-");
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
        return cb(null, true);
    }

    cb(new ExpressError(400, "Only image files are allowed!"));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { files: 6 }
});
const DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=60";
const FILTER_OPTIONS = [
    { key: "hotels", label: "Hotels", icon: "fa-solid fa-hotel", keywords: ["hotel", "resort", "stay", "suite", "lodge", "boutique", "villa", "ritz"] },
    { key: "rooms", label: "Rooms", icon: "fa-solid fa-bed", keywords: ["room", "suite", "apartment", "house", "villa", "lodge"] },
    { key: "city-stays", label: "City Stays", icon: "fa-solid fa-building", keywords: ["city", "mumbai", "paris", "london", "dubai", "chandigarh", "piccadilly", "southbank", "sector"] },
    { key: "breakfast", label: "Breakfast", icon: "fa-solid fa-mug-hot", keywords: ["breakfast", "cafe", "coffee", "food", "dining"] },
    { key: "private-stay", label: "Private Stay", icon: "fa-solid fa-key", keywords: ["private", "villa", "apartment", "house", "boutique"] },
    { key: "pool", label: "Pool", icon: "fa-solid fa-person-swimming", keywords: ["pool", "villa", "tropical", "resort", "lake", "marine", "water", "beach"] },
    { key: "ac-rooms", label: "AC Rooms", icon: "fa-solid fa-snowflake", keywords: ["ac", "cool", "snow", "peak", "comfort"] },
    { key: "service", label: "Service", icon: "fa-solid fa-bell-concierge", keywords: ["service", "host", "hospitality", "luxury", "resort", "ritz"] },
    { key: "gym", label: "Gym", icon: "fa-solid fa-dumbbell", keywords: ["gym", "fitness", "luxury", "resort", "boutique"] },
    { key: "resort", label: "Resort", icon: "fa-solid fa-umbrella-beach", keywords: ["resort", "beach", "tropical", "desert", "safari", "villa"] },
    { key: "bath", label: "Bath", icon: "fa-solid fa-bath", keywords: ["bath", "spa", "luxury", "suite"] },
    { key: "wifi", label: "Wifi", icon: "fa-solid fa-wifi", keywords: ["wifi", "wi-fi", "internet", "wireless"] },
    { key: "spa", label: "Spa", icon: "fa-solid fa-spa", keywords: ["spa", "resort", "luxury", "relax"] },
    { key: "aqua-fun", label: "Aqua Fun", icon: "fa-solid fa-water-ladder", keywords: ["water", "lake", "pool", "beach", "marine", "tropical"] },
    { key: "elevator", label: "Elevator", icon: "fa-solid fa-elevator", keywords: ["tower", "city", "apartment", "hotel", "suite"] },
    { key: "dining", label: "Dining", icon: "fa-solid fa-utensils", keywords: ["dining", "food", "restaurant", "breakfast", "cafe"] },
    { key: "luxury", label: "Luxury", icon: "fa-solid fa-champagne-glasses", keywords: ["luxury", "ritz", "premium", "beautiful", "elegant"] },
    { key: "pickup", label: "Pickup", icon: "fa-solid fa-car-side", keywords: ["airport", "pickup", "drive", "marine", "city"] },
    { key: "safe-stay", label: "Safe Stay", icon: "fa-solid fa-shield-heart", keywords: ["safe", "family", "secure", "comfort", "host"] },
    { key: "premium", label: "Premium", icon: "fa-solid fa-star", keywords: ["premium", "luxury", "ritz", "boutique", "beautiful"] }
];

const FILTER_KEY_SET = new Set(FILTER_OPTIONS.map((filter) => filter.key));

async function removeLocalUpload(filePath) {
    if (!filePath) {
        return;
    }

    await removeFile(filePath).catch(() => {});
}

async function removeLocalUploads(files = []) {
    await Promise.all(files.map((file) => removeLocalUpload(file?.path)));
}

async function uploadImagesToCloudinary(files = []) {
    if (!files.length) {
        return [];
    }

    if (!hasCloudinaryConfig()) {
        await removeLocalUploads(files);
        throw new ExpressError(500, "Cloudinary credentials are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
    }

    try {
        const uploads = await Promise.all(
            files.map((file) =>
                cloudinary.uploader.upload(file.path, {
                    folder: "luxestay_listings",
                    resource_type: "image"
                })
            )
        );

        return uploads.map((result, index) => ({
            filename: result.original_filename || files[index].filename,
            url: result.secure_url,
            publicId: result.public_id
        }));
    } finally {
        await removeLocalUploads(files);
    }
}

async function deleteCloudinaryImage(image) {
    if (!image || !image.publicId || !hasCloudinaryConfig()) {
        return;
    }

    await cloudinary.uploader.destroy(image.publicId, {
        resource_type: "image"
    });
}

async function deleteCloudinaryImages(images = []) {
    await Promise.all(images.map((image) => deleteCloudinaryImage(image)));
}

function normalizeGalleryImages(listing) {
    const savedImages = Array.isArray(listing?.images) && listing.images.length
        ? listing.images
        : listing?.image
            ? [listing.image]
            : [];

    const normalizedImages = savedImages
        .map((image) => {
            if (!image) return null;

            if (typeof image === "string") {
                return {
                    filename: "listingimage",
                    url: image,
                    publicId: null
                };
            }

            return {
                filename: image.filename || "listingimage",
                url: image.url || DEFAULT_IMAGE_URL,
                publicId: image.publicId || null
            };
        })
        .filter(Boolean);

    return normalizedImages.length ? normalizedImages.slice(0, 6) : [{
        filename: "listingimage",
        url: DEFAULT_IMAGE_URL,
        publicId: null
    }];
}

function getOptimizedImageUrl(image, variant = "card") {
    if (!image) {
        return DEFAULT_IMAGE_URL;
    }

    if (image.publicId && hasCloudinaryConfig()) {
        const transformationsByVariant = {
            card: {
                width: 800,
                height: 600,
                crop: "fit",
                quality: "auto",
                fetch_format: "auto"
            },
            show: {
                width: 1400,
                height: 1000,
                crop: "fit",
                quality: "auto",
                fetch_format: "auto"
            },
            edit: {
                width: 900,
                height: 550,
                crop: "fit",
                quality: "auto",
                fetch_format: "auto"
            }
        };

        return cloudinary.url(image.publicId, {
            secure: true,
            ...transformationsByVariant[variant]
        });
    }

    return image.url || DEFAULT_IMAGE_URL;
}

function attachListingImageUrls(listing) {
    if (!listing) {
        return listing;
    }

    const galleryImages = normalizeGalleryImages(listing);
    const primaryImage = galleryImages[0] || {
        filename: "listingimage",
        url: DEFAULT_IMAGE_URL,
        publicId: null
    };

    listing.images = galleryImages;
    listing.image = primaryImage;
    listing.imageCardUrl = getOptimizedImageUrl(primaryImage, "card");
    listing.imageShowUrl = getOptimizedImageUrl(primaryImage, "show");
    listing.imageEditUrl = getOptimizedImageUrl(primaryImage, "edit");
    listing.imageFallbackUrl = primaryImage.url || DEFAULT_IMAGE_URL;
    listing.galleryImageUrls = galleryImages.map((image) => getOptimizedImageUrl(image, "show"));
    return listing;
}

function getListingSearchText(listing) {
    return [
        listing?.title,
        listing?.description,
        listing?.location,
        listing?.country
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function getListingFilterKeys(listing) {
    const text = getListingSearchText(listing);
    const matchedFilters = FILTER_OPTIONS.filter((filter) =>
        filter.keywords.some((keyword) => text.includes(keyword))
    ).map((filter) => filter.key);

    // Baseline tags taaki common hotel listings useful filters me aa saken.
    if (!matchedFilters.includes("hotels")) matchedFilters.push("hotels");
    if (!matchedFilters.includes("rooms")) matchedFilters.push("rooms");

    if (listing?.price >= 10000) {
        matchedFilters.push("luxury", "premium", "service");
    }

    if (/villa|resort|tropical|lake|marine|beach|water/i.test(text)) {
        matchedFilters.push("pool", "aqua-fun", "resort");
    }

    if (/city|london|paris|mumbai|dubai|chandigarh|sector|southbank|piccadilly/i.test(text)) {
        matchedFilters.push("city-stays", "elevator");
    }

    return [...new Set(matchedFilters)].filter((key) => FILTER_KEY_SET.has(key));
}

function matchesFilter(listing, activeFilter) {
    if (!activeFilter) {
        return true;
    }

    return getListingFilterKeys(listing).includes(activeFilter);
}

function matchesSearch(listing, searchQuery) {
    if (!searchQuery) {
        return true;
    }

    return getListingSearchText(listing).includes(searchQuery.toLowerCase());
}

function getListingHighlight(listing) {
    const filterKeys = getListingFilterKeys(listing);
    const preferredKeys = [
        "pool",
        "wifi",
        "gym",
        "spa",
        "breakfast",
        "resort",
        "luxury",
        "service",
        "premium",
        "dining"
    ];

    const matchedKey = preferredKeys.find((key) => filterKeys.includes(key));
    const matchedFilter = FILTER_OPTIONS.find((filter) => filter.key === matchedKey);

    if (matchedFilter) {
        return {
            label: matchedFilter.label,
            icon: matchedFilter.icon
        };
    }

    return {
        label: "Comfort Stay",
        icon: "fa-solid fa-hotel"
    };
}

// --- 1. validateListing मिडलवेयर ---
const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        if (req.files?.length) {
            removeLocalUploads(req.files);
        }
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

function normalizeListingData(listing = {}, uploadedImages = [], existingImages = [], existingImage) {
    if (uploadedImages.length) {
        return {
            ...listing,
            image: uploadedImages[0],
            images: uploadedImages
        };
    }

    if (existingImages.length) {
        return {
            ...listing,
            image: existingImages[0],
            images: existingImages
        };
    }

    const imageValue = typeof listing.image === "string" ? listing.image.trim() : "";

    if (existingImage && !imageValue) {
        return {
            ...listing,
            image: existingImage,
            images: [existingImage]
        };
    }

    return {
        ...listing,
        image: {
            filename: "listingimage",
            url: imageValue || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=60"
        },
        images: [
            {
                filename: "listingimage",
                url: imageValue || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=60",
                publicId: null
            }
        ]
    };
}

async function attachReviewAuthorNames(listing) {
    if (!listing || !Array.isArray(listing.reviews) || listing.reviews.length === 0) {
        return listing;
    }

    const snapshotNameByReviewId = new Map(
        (listing.reviewSnapshots || []).map((snapshot) => [String(snapshot.reviewId), snapshot.authorName])
    );

    const authorIds = [];

    for (const review of listing.reviews) {
        if (!review) continue;

        if (review.author && typeof review.author === "object" && review.author.username) {
            review.authorDisplayName = review.author.username;
            continue;
        }

        if (review.authorName) {
            review.authorDisplayName = review.authorName;
            continue;
        }

        if (review.author) {
            authorIds.push(String(review.author));
        } else {
            review.authorDisplayName = snapshotNameByReviewId.get(String(review._id)) || "Anonymous";
        }
    }

    if (authorIds.length === 0) {
        return listing;
    }

    const uniqueAuthorIds = [...new Set(authorIds)];
    const [primaryUsers, fallbackUsers] = await Promise.all([
        User.find({ _id: { $in: uniqueAuthorIds } }, { username: 1 }).lean(),
        FallbackUser
            ? FallbackUser.find({ _id: { $in: uniqueAuthorIds } }, { username: 1 }).lean()
            : Promise.resolve([])
    ]);
    const usernameById = new Map(
        [...primaryUsers, ...fallbackUsers].map((user) => [String(user._id), user.username])
    );

    for (const review of listing.reviews) {
        if (!review || review.authorDisplayName) continue;
        review.authorDisplayName =
            usernameById.get(String(review.author)) ||
            review.authorName ||
            snapshotNameByReviewId.get(String(review._id)) ||
            "Anonymous";
    }

    return listing;
}

// --- सुधरयोड़ो Helper Function ---
async function findListingById(id) {
    // Primary DB में खोजो और author तक populate करो
    let listing = await Listing.findById(id)
        .populate("owner")
        .populate({
            path: "reviews",
            populate: { path: "author" },
            options: { sort: { createdAt: -1 } }
        });

    if (listing) {
        attachListingImageUrls(listing);
        await attachReviewAuthorNames(listing);
        return { listing, source: "primary" };
    }

    if (FallbackListing) {
        // Fallback DB में खोजो
        listing = await FallbackListing.findById(id)
            .populate({
                path: "owner",
                model: User
            })
            .populate({
                path: "reviews",
                model: FallbackReview,
                populate: { path: "author", model: User },
                options: { sort: { createdAt: -1 } }
            });

        if (listing) {
            attachListingImageUrls(listing);
            await attachReviewAuthorNames(listing);
            return { listing, source: "fallback" };
        }
    }

    return { listing: null, source: null };
}

// --- ROUTES ---

// INDEX ROUTE
router.get("/", wrapAsync(async (req, res) => {
    const activeFilter = FILTER_KEY_SET.has(req.query.filter) ? req.query.filter : "";
    const searchQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
    let allListings = await Listing.find({});
    if (allListings.length === 0 && FallbackListing) {
        allListings = await FallbackListing.find({});
    }
    allListings.forEach((listing) => {
        attachListingImageUrls(listing);
        listing.filterKeys = getListingFilterKeys(listing);
        listing.highlight = getListingHighlight(listing);
    });

    const filteredListings = allListings.filter((listing) =>
        matchesFilter(listing, activeFilter) && matchesSearch(listing, searchQuery)
    );

    res.render("listings/index.ejs", {
        allListings: filteredListings,
        filterOptions: FILTER_OPTIONS,
        activeFilter,
        searchQuery
    });
}));

// NEW ROUTE
router.get("/new", isLoggedIn, (req, res) => {
    res.render("listings/new.ejs");
});

// CREATE ROUTE
router.post("/",
    isLoggedIn,
    upload.array("listing[images]", 6),
    validateListing,
    wrapAsync(async (req, res) => {
        const cloudinaryImages = await uploadImagesToCloudinary(req.files);
        const newListing = new Listing(normalizeListingData(req.body.listing, cloudinaryImages));
        newListing.owner = req.user._id;
        await newListing.save();
        req.flash("success", "New listing created!");
        res.redirect("/listings");
    })
);

// SHOW ROUTE (सुधरयोड़ो)
router.get("/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    // findListingById के अंदर ही सारा populate कर दिया है
    const { listing } = await findListingById(id.trim());

    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/show.ejs", { listing });
}));

// EDIT ROUTE
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { listing } = await findListingById(id.trim());

    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/edit.ejs", { listing });
}));

// UPDATE ROUTE (Primary और Fallback दोनूं वास्ते)
router.put("/:id",
    isLoggedIn,
    isOwner,
    upload.array("listing[images]", 6),
    validateListing,
    wrapAsync(async (req, res) => {
        const { id } = req.params;
        let currentListing = await Listing.findById(id);
        let updateTarget = currentListing ? Listing : FallbackListing;

        if (!currentListing && FallbackListing) {
            currentListing = await FallbackListing.findById(id);
        }

        if (!currentListing) {
            req.flash("error", "Listing you requested for does not exist!");
            return res.redirect("/listings");
        }

        const cloudinaryImages = await uploadImagesToCloudinary(req.files);
        const existingImages = Array.isArray(currentListing.images) && currentListing.images.length
            ? currentListing.images
            : currentListing.image
                ? [currentListing.image]
                : [];
        const updateData = normalizeListingData(req.body.listing, cloudinaryImages, existingImages, currentListing.image);

        if (cloudinaryImages.length) {
            await deleteCloudinaryImages(existingImages);
        }

        await updateTarget.findByIdAndUpdate(id, updateData);

        req.flash("success", "Listing Updated!");
        res.redirect(`/listings/${id}`);
    })
);

// DELETE ROUTE (Primary और Fallback दोनूं वास्ते)
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const { id } = req.params;

    let listing = await Listing.findByIdAndDelete(id);
    if (!listing && FallbackListing) {
        listing = await FallbackListing.findByIdAndDelete(id);
    }

    const imagesToDelete = Array.isArray(listing?.images) && listing.images.length
        ? listing.images
        : listing?.image
            ? [listing.image]
            : [];
    await deleteCloudinaryImages(imagesToDelete);

    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
}));

module.exports = router;
