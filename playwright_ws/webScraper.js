import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const links = [];

/**
 *  link : [str]
 *  title : []
 *  amount of that word : [int]
 *  pdf name : [str]
 *  
 */


const ret = []
/**
 * #########################
 *  find_data
 * #########################
 * 
 *  params:
 *      browser -> current browser that we using for playwright
 *      links -> array of links (str) that we need to find data for
 * 
 *  Finds all the data that we need...
 *      1. All paragraphs of that specific link
 *      2. The pdf file that we need for own OCR
 * 
 *  
 */
async function findData(browser, links, storage = []) {
    // Iterate w/ index of the arr and the link accessed
    for (const [index, link] of links.entries()) {
        try {
            console.log(`\n[${index + 1}/${links.length}] Navigating to: ${link}`);
            
            // Open links & wait for full load 
            console.log('Opening links and waiting for page to load...')
            const newPage = await browser.newPage();
            await newPage.goto(link);
            await newPage.waitForLoadState('load');
            await newPage.waitForLoadState('networkidle');
            await newPage.waitForSelector('#documentdisplayleftpane #documentdisplayleftpanecontent', { timeout : 60000});
            await newPage.waitForSelector('#documentdisplayleftpanesectiontextcontainer', { timeout : 60000});

            console.log('Collecting internal link with the time')
            const currPageLink = await newPage.locator('#eastview-share-wrapper input')
            const inputValue = await currPageLink.getAttribute('value');

            // Collect Paragraphs
            console.log('Collecting paragraphs...')
            const currPageContent = await newPage.locator('#documentdisplayleftpane #documentdisplayleftpanecontent');
            const paragraphs = await currPageContent.locator('#documentdisplayleftpanesectiontextcontainer p').allTextContents();

            // Merge the paragraphs into a single string
            const mergedParagraph = paragraphs.join(' ');

            console.log(mergedParagraph);

            // Collect word count in paragraphs
            console.log('Collecting word count...')
            const re = new RegExp("二世", "g");
            let numWords = 0
            paragraphs.forEach(element => {
                const matches = [...element.matchAll(re)]; 
                numWords += matches.length
            });

            // Collect PDF File Link
            console.log('Collecting PDF link...')
            const pdfLink = await newPage.locator('#oseadpagelevellinkscontainer a').getAttribute('href')
            const fullPdfLink = `https://hojishinbun.hoover.org${pdfLink}`

            // Download the PDF File
            console.log('Downloading PDF file...')
            const downloadPromise = newPage.waitForEvent('download');
            await newPage.evaluate((fullPdfLink) => {
                window.location.href = fullPdfLink;
              }, fullPdfLink);
            const download = await downloadPromise;
            await download.saveAs('pdf_files/' + download.suggestedFilename());
            
            // Add necessary data into json file
            const storageLinks = {
                'link' : link,
                'linkWithDate' : inputValue,
                'numWords' : numWords,
                'paragraphs' : mergedParagraph,
                'pdfName' : download.suggestedFilename()
            };
            storage.push(storageLinks)
            

            // Close the page
            await newPage.close(); 
        } catch (e) {
            console.error(`Error processing ${link}:`, e);
        }
    }
    return storage
}

async function findSingleData (page, link, storage = []) {
    try {
        console.log(`Navigating to: ${link}`);
        
        // Collect Paragraphs
        console.log('Collecting paragraphs...')
        const currPageContent = await newPage.locator('#documentdisplayleftpane #documentdisplayleftpanecontent');
        const paragraphs = await currPageContent.locator('#documentdisplayleftpanesectiontextcontainer p').allTextContents();

        // Collect word count in paragraphs
        console.log('Collecting word count...')
        const re = new RegExp("二世", "g");
        let numWords = 0
        paragraphs.forEach(element => {
            const matches = [...element.matchAll(re)]; 
            numWords += matches.length
        });

 
        // Add necessary data into json file
        const storageLinks = {
            'link' : link,
            'numWords' : numWords,
            'paragraphs' : paragraphs,
        };
        storage.push(storageLinks)
        

        // Close the page
        await newPage.close(); 
    } catch {
        console.error(`Error processing ${link}:`, e);
    }
    return storage
}

/**
 * #########################
 *  find_links
 * #########################
 * 
 *  params:
 *      browser -> current browser that we using for playwright
 *      page -> current page that playwright is on
 *      amount -> How much pages are we getting?
 * 
 *  Finds all the links of that specific word (filter inclusive)
 *  
 *  
 */
async function findLinks(page, storage = []) {
    try {
        // Find class search results
        const searchList = await page.locator('.fullwidthwrapper .searchresults');

        // Count <li> elements
        const countLi = await searchList.locator('li').count();
        console.log(`Total number of <li> elements: ${countLi}`);

        // Get all links on this page
        for (let i = 0; i < countLi; i++) {
            const listItem = searchList.locator('li').nth(i);
            const href = await listItem.locator('div.vlistentrymaincell a').first().getAttribute('href');
            if (href) { // Ensure href is not null
                storage.push(`https://hojishinbun.hoover.org${href}`);
            }
        }
    } catch (e) {
        console.error('Error during initial navigation or scraping:', e);
    } 
    return storage;
}


async function autoSearch (browser, startPage, amount = Infinity) {
    try {
        let res = []
        let currentPage = startPage
        let prevPage = ''
    
        for (let i = 0; i < amount; i++) {
            // Initialize the page we are going to
            const page = await browser.newPage();
            await page.goto(currentPage)
            await page.waitForLoadState('load');

            // Collect the links
            const findNavLinks = await page.locator('.fullwidthwrapper #searchpagesearchresults nav .page-item a');
            const linksCount = await findNavLinks.count();
            console.log(`These are the links navigations${linksCount}`)


            // Collect the links
            let collectedLinks = await findLinks(page, [])
            res.push(...collectedLinks);

            // Collect the data

            console.log('Finding next links now')
            // If there are links to go to 
            if (linksCount && prevPage != currentPage) {
                // Init the
                prevPage = currentPage

                // Init the second nav page
                const continueSearch = await findNavLinks.nth(linksCount - 1).getAttribute('href');
                currentPage = `https://hojishinbun.hoover.org${continueSearch}`;
                console.log(`This is the next page ${currentPage}`)
            } else {
                console.log('Breaking now')
                break
            }
        }
        return res
    } catch (e) {
        console.error('Error during initial navigation or scraping:', e);
    }
}

function convertToCSV(array, delimiter = '|') {
    if (!array.length) {
        return '';
    }

    // Extract headers (keys) from the first object
    const headers = Object.keys(array[0]).join(delimiter);

    // Map over data to create rows
    const rows = array.map(obj => {
        return Object.values(obj)
            .map(value => `"${value}"`) // Wrap values in quotes to handle special characters
            .join(delimiter);
    });

    // Combine headers and rows with newlines
    return [headers, ...rows].join('\n');
}

(async () => {

    var data = []
    const browser = await chromium.launch({ headless: true }); // Set to false if you want to see the browser
    const l = await autoSearch(browser, 'https://hojishinbun.hoover.org/?a=q&hs=1&r=1&results=1&txq=Negro&dafdq=&dafmq=&dafyq=&datdq=&datmq=&datyq=&puq=&ssnip=img&qp=1&e=-------en-10--1-byDA-img-negro-PAGE-----', 500)
    data = await findData(browser, l, data)

    const jsonData = JSON.stringify(data, null, 2); // Pretty-print JSON
    fs.writeFileSync('output.json', jsonData, 'utf8');
    console.log('JSON file created successfully!');

    await browser.close()
})();

export {findData, findLinks, autoSearch, findSingleData}