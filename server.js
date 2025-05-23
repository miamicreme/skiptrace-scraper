const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/scrape", async (req, res) => {
  const { name, city, state } = req.body;
  const query = `${name} ${city} ${state}`;
  const url = `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(query)}`;

  console.log("🔍 Incoming request:", query);

  let browser;
  try {
    const executablePath = "/usr/bin/chromium-browser";
    console.log("🧠 Chromium path (forced):", executablePath);

    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-zygote",
        "--disable-gpu"
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    });

    console.log("✅ Browser launched");

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
    );

    console.log("🌐 Navigating to:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
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

  } catch (err) {
    console.error("❌ Scrape failed:", err.message);
    console.error(err);
    if (browser) await browser.close();
    res.status(500).json({ error: "Scrape failed", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
