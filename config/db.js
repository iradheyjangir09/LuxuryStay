if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const DB_NAME = process.env.DB_NAME || "dataji";
const LOCAL_MONGO_URL = `mongodb://127.0.0.1:27017/${DB_NAME}`;
const MONGO_URL = process.env.MONGO_URL ||
    process.env.ATLASDB_URL ||
    (process.env.NODE_ENV === "production" ? null : LOCAL_MONGO_URL);
const FALLBACK_DB_NAME = DB_NAME === "dataji" ? "wonderlust" : "dataji";
const FALLBACK_MONGO_URL = process.env.FALLBACK_MONGO_URL ||
    (process.env.NODE_ENV === "production" ? null : `mongodb://127.0.0.1:27017/${FALLBACK_DB_NAME}`);

module.exports = {
    DB_NAME,
    MONGO_URL,
    FALLBACK_DB_NAME,
    FALLBACK_MONGO_URL
};
