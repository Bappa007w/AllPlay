// One explicit CommonJS boundary for Vercel's Node function loader.
// Express's builder detects a conventional app entrypoint that imports express.
require("express");
module.exports = require("./dist/deploy/app.cjs");
