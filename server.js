const express = require("express");
const cors = require("cors");
// OLD
// const { chromium } = require("playwright");

// NEW
const chromium = require("playwright-aws-lambda").chromium;

const app = express();
app.use(cors());
app.use(express.json());

app.post("/scrape", async (req, res) => {
  const { name, city, state } = req.body;
  const query = `${name} ${city} ${state}`;

  console.log("🔍 Incoming request:", query);

  try {
    const browser = await chromium.launch({ headless: true });
    console.log("✅ Browser launched");

    const page = await browser.newPage();
    await page.goto(`https://www.truepeoplesearch.com/results?name=${encodeURIComponent(query)}`);
    console.log("✅ Page loaded");

    await page.waitForSelector(".card-summary", { timeout: 10000 });
    console.log("✅ Selector found");

    const result = await page.evaluate(() => {
      const name = document.querySelector(".card-summary h2")?.innerText.trim() || "N/A";
      const phone = document.querySelector(".content-section ul li")?.innerText.trim() || "N/A";
      const address = document.querySelector(".content-section .link-to-more")?.innerText.trim() || "N/A";
      return { name, phone, address };
    });

    console.log("✅ Scrape success:", result);
    await browser.close();
    res.json(result);

  } catch (error) {
    console.error("❌ Scrape failed:", error.message);
    res.status(500).json({ error: "Scrape failed", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
