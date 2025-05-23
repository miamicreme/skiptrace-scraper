const express = require("express");
const cors = require("cors");
const chromium = require("@sparticuz/chromium");
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
    const executablePath = await chromium.executablePath();
    process.env.CHROME_PATH = executablePath;
    console.log("🧠 Chromium path set:", executablePath);

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        ...chromium.args,
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote"
      ],
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
      env: {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: executablePath
      },
      dumpio: true
    });

    console.log("✅ Browser launched");

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
    );

    console.log("🌐 Navigating to:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("✅ Page loaded");

    const html = await page.content();
    console.log("🔎 First 500 chars of page:", html.slice(0, 500));
    await browser.close();
    res.json({ snippet: html.slice(0, 500) });

  } catch (err) {
    console.error("❌ Scrape failed:", err.message);
    console.error(err);
    if (browser) await browser.close();
    res.status(500).json({ error: "Scrape failed", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
