import { chromium } from "playwright";
import fs from "fs";
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

/**
 * Detects if the script goes to a page that has restricted access (need stanford account)
 */
async function isLoginPage(page) {
  const url = page.url();
  if (url.includes("ShowAuthenticateUserPage")) return true;

  // If the article pane is missing, it's a restricted access page
  const hasArticlePane = await page
    .locator("#documentdisplayleftpane #documentdisplayleftpanecontent")
    .count();
  return hasArticlePane === 0;
}

/**
 * Navigate with automatic retries so that transient DNS or network failures
 * don’t abort the whole crawl. Optionally skips pages that require login.
 */
async function safeGoto(page, url, opts = {}) {
  const {
    timeout = 30_000,       // seconds waiting until page times out
    retries = 3,            
    waitUntil = "load",  
    expectArticle = false,  
  } = opts;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await page.goto(url, { timeout, waitUntil });
      await page.waitForLoadState("networkidle");

      // if we got a bad HTTP status or landed restricted access page, bail out.
      if (
        (response && response.status() >= 400) ||
        (expectArticle && (await isLoginPage(page)))
      ) {
        throw new Error("login-required");
      }
      return;
    } catch (err) {
      // if it’s a restrcited access page, don’t retry.
      if (err.message === "login-required") throw err;

      if (attempt === retries) throw err;
      console.warn(
        `[safeGoto retry ${attempt}/${retries}] ${url} – ${err.message}`
      );
      await page.waitForTimeout(1_000 * attempt); 
    }
  }
}

/**
 * visit all article links to collect...
 * 1. URL
 * 2. URL with date included
 * 3. article paragraphs
 * 4. count of target word
 * 
 * NOTE: will skip links that require login.
 */
async function findData(browser, links, storage = [], targetString) {
  for (const [index, link] of links.entries()) {
    const page = await browser.newPage();
    try {
      console.log(`\n[${index + 1}/${links.length}] Navigating to: ${link}`);
      await safeGoto(page, link, { expectArticle: true }); // throws if login required

      await page.waitForSelector(
        "#documentdisplayleftpane #documentdisplayleftpanecontent",
        { timeout: 60_000 } // 60 second timeout
      );

      // collect URL that contains the publication date
      const linkWithDate = await page
        .locator("#eastview-share-wrapper input")
        .getAttribute("value");

      // article paragraphs
      const paragraphs = await page
        .locator(
          "#documentdisplayleftpane #documentdisplayleftpanesectiontextcontainer p"
        )
        .allTextContents();
      const mergedParagraphs = paragraphs.join(" ");

      // count occurrences of the search term
      function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      const re = new RegExp(escapeRegExp(targetString), "g");
      const numWords = paragraphs.reduce(
        (sum, p) => sum + (p.match(re)?.length || 0),
        0
      );

      storage.push({
        link,
        linkWithDate,
        numWords,
        paragraphs: mergedParagraphs,
      });
    } catch (e) {
      if (e.message === "login-required") {
        console.warn(`[skip] ${link} : login required`);
      } else {
        console.error(`Error processing ${link}:`, e);
      }
    } finally {
      await page.close();
    }
  }
  return storage;
}

/**
 * Scrape a single article that’s already open on `page`.
 */
async function findSingleData(page, link, storage = []) {
  try {
    console.log(`Navigating to: ${link}`);
    await safeGoto(page, link, { expectArticle: true });

    await page.waitForSelector(
      "#documentdisplayleftpane #documentdisplayleftpanecontent",
      { timeout: 60_000 }
    );

    const paragraphs = await page
      .locator(
        "#documentdisplayleftpane #documentdisplayleftpanesectiontextcontainer p"
      )
      .allTextContents();

    const re = /二世/g;
    const numWords = paragraphs.reduce(
      (sum, p) => sum + (p.match(re)?.length || 0),
      0
    );

    storage.push({
      link,
      numWords,
      paragraphs: paragraphs.join(" "),
    });
  } catch (e) {
    if (e.message === "login-required") {
      console.warn(`[skip] ${link} – login required`);
    } else {
      console.error(`Error processing ${link}:`, e);
    }
  }
  return storage;
}

/**
 * extract all article links from the current search-results page.
 */
async function findLinks(page, linkStorage = []) {
  try {
    const searchSources = page.locator(".fullwidthwrapper .searchresults");
    const countSource = await searchSources.locator("li").count();
    console.log(`Total number of sources on this page: ${countSource}`);

    for (let i = 0; i < countSource; i++) {
      // locating links through website source code
      const href = await searchSources
        .locator("li")
        .nth(i)
        .locator("div.vlistentrymaincell a")
        .first()
        .getAttribute("href");
      if (href) {
        linkStorage.push(`https://hojishinbun.hoover.org${href}`)
      }
    }
  } catch (e) {
    console.error("Error scraping links on current result page:", e);
  }
  return linkStorage;
}

/**
 * automatically go through a select amount of pages and collect the URL required for data collection
 */
async function autoSearch(browser, startPage, amount = Infinity) {
  const results = [];
  let currentPage = startPage;
  let prevPage = "";

  for (let i = 0; i < amount; i++) {
    const page = await browser.newPage();
    try {
      await safeGoto(page, currentPage);

      // adds article links on this page to the list storage
      results.push(...(await findLinks(page, [])));

      // locate the all available links to navigate to
      const navLinks = page.locator(
        ".fullwidthwrapper #searchpagesearchresults nav .page-item a"
      );
      const count = await navLinks.count();
      console.log(`Available navigation links: ${count}`);

      if (count === 0) {
        break; // no more pages
      }

      // seeing if there is another link we can naviagte to
      const nextHref = await navLinks.nth(count - 1).getAttribute("href");
      if (!nextHref) {
        break;
      }

      const nextPage = `https://hojishinbun.hoover.org${nextHref}`;
      if (nextPage === prevPage) {
        break; // reached the end
      }

      prevPage = currentPage;
      currentPage = nextPage;
    } catch (e) {
      if (e.message === "login-required") {
        console.warn(`[skip search page] ${currentPage} – login required`);
        break;
      } else {
        console.error("autoSearch navigation error:", e);
        break;
      }
    } finally {
      await page.close();
    }
  }

  return results;
}

/**
 * code to run the script
 * edit things here
 */
(async () => {
  const browser = await chromium.launch({ headless: true });

  // user input for word and and file name
  const rl = readline.createInterface({ input, output });

  const word = (await rl.question("Enter the word you want to search for: ")).trim();
  const fileName = (await rl.question("Enter a file name (without extension): ")).trim();
  const START_URL = (await rl.question("Enter URL to start scraping from: ")).trim();
  const pages = Number(await rl.question("Enter the number of pages to search: "));

  rl.close();

  // overwrite file warning
  const jsonName = `output-${fileName}.json`;
  if (fs.existsSync(jsonName)) {
    console.warn(`Warning: ${jsonName} already exists and will be overwritten.`);
  }

  // Making sure its a number
  if (isNaN(pages) || pages <= 0) {
    console.error("Invalid number of pages. Please enter a positive integer.");
    await browser.close();
    return;
  }


  // automatically search through more availalbe pages starting with the START_URL to the amount of pages you want
  // change the amount of pages to search by changing the number in the autosSearch parameter
  // NOTE: it means 500 PAGES not 500 LINKS
  const links = await autoSearch(browser, START_URL, pages);
  if (!links.length) {
    console.error("No links returned from autoSearch. Exiting.");
    await browser.close();
    return;
  }

  const data = await findData(browser, links, [], word);

  // file name validation
  const isValidFileName = /^[^<>:"/\\|?*\x00-\x1F]+$/.test(fileName) && fileName.trim() !== "";
  if (!isValidFileName) {
    throw new Error(`Invalid file name: "${fileName}"`);
  } 

  fs.writeFileSync(jsonName, JSON.stringify(data, null, 2), "utf8");
  console.log(`JSON file ${jsonName} created successfully!`);

  await browser.close();
})();
