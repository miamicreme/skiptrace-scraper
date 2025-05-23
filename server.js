import "dotenv/config.js";
import express from "express";
import cors from "cors";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import puppeteerExtra from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";

puppeteerExtra.use(Stealth());          // ➜ hides headless fingerprints
const PROXY = process.env.RES_PROXY;    // ➜ residential proxy URL (optional)

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- helper to launch Chromium ---------- */
async function launchBrowser() {
  const execPath = await chromium.executablePath();      // /tmp/chromium
  return puppeteerExtra.launch({
    executablePath: execPath,
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport,
    args: [
      ...chromium.args,
      "--no-sandbox",
      ...(PROXY ? [`--proxy-server=${PROXY}`] : [])
    ],
    ignoreHTTPSErrors: true,
    dumpio: false
  });
}

/* ---------- site-specific scrapers ---------- */
const scrapers = {
  /** TruePeopleSearch – needs proxy */
  tps: async (page, q) => {
    const { name, city, state } = q;
    const url =
      `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(
        `${name} ${city} ${state}`)}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".card-summary", { timeout: 8000 });

    return page.evaluate(() => ({
      name:    document.querySelector(".card-summary h2")?.textContent.trim() ?? "N/A",
      phone:   document.querySelector(".content-section ul li")?.textContent.trim() ?? "N/A",
      address: document.querySelector(".content-section .link-to-more")?.textContent.trim() ?? "N/A",
    }));
  },

  /** FastPeopleSearch – works without proxy */
  fps: async (page, q) => {
    const { name, city, state } = q;
    const url =
      `https://www.fastpeoplesearch.com/name/${encodeURIComponent(name)}/${encodeURIComponent(city)}-${state}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".result-content", { timeout: 8000 });

    return page.evaluate(() => ({
      name:    document.querySelector(".result-content h2")?.textContent.trim() ?? "N/A",
      phone:   document.querySelector(".result-content .phone")?.textContent.trim() ?? "N/A",
      address: document.querySelector(".result-content .address")?.textContent.trim() ?? "N/A",
    }));
  },

  /** That'sThem */
  thatsthem: async (page, q) => {
    const { name, city, state } = q;
    const url =
      `https://thatsthem.com/name/${encodeURIComponent(name.replace(/\\s+/g, "-"))}-${city}-${state}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".results-table-row", { timeout: 8000 });

    return page.evaluate(() => ({
      name:    document.querySelector(".results-table-row span")?.textContent.trim() ?? "N/A",
      phone:   document.querySelector(".results-table-row .result-phone")?.textContent.trim() ?? "N/A",
      address: document.querySelector(".results-table-row .result-address")?.textContent.trim() ?? "N/A",
    }));
  },

  /** FamilyTreeNow */
  ftn: async (page, q) => {
    const { name } = q;
    const [first, last] = name.split(" ");
    const url =
      `https://www.familytreenow.com/search/genealogy/results?first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".person", { timeout: 8000 });

    return page.evaluate(() => ({
      name:    document.querySelector(".person h3")?.textContent.trim() ?? "N/A",
      address: document.querySelector(".person .address")?.textContent.trim() ?? "N/A",
      phone:   "N/A"
    }));
  }
};

/* ---------- /scrape API ---------- */
app.post("/scrape", async (req, res) => {
  const { name, city = "", state = "" } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
    );

    // run scrapers in parallel
    const tasks = Object.entries(scrapers).map(async ([key, fn]) => {
      try {
        const data = await fn(page, { name, city, state });
        return { site: key, ok: true, ...data };
      } catch (err) {
        return { site: key, ok: false, error: err.message };
      }
    });

    const results = await Promise.all(tasks);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("⇢ skip-trace backend up on", PORT));
