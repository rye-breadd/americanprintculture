import { chromium } from "playwright";
import {v4 as uuidv4} from 'uuid';
import fs from "fs";

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
            await newPage.waitForSelector('#documentdisplayleftpane #documentdisplayleftpanecontent', { timeout : 15000});
            await newPage.waitForSelector('#documentdisplayleftpanesectiontextcontainer', { timeout : 15000});

            // Checking if we are able to access the document
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

            /*
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
            */
            
            // Add necessary data into json file
            const storageLinks = {
                'link' : link,
                'linkWithDate' : inputValue,
                'numWords' : numWords,
                'paragraphs' : mergedParagraph,
                //'pdfName' : download.suggestedFilename()
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
async function findLinks(page, linkStorage = []) {
    try {
        const searchSources = await page.locator('.fullwidthwrapper .searchresults');
        const countSource = await searchSources.locator('li').count();
        console.log(`Total number of sources in this page ${countSource}`);

        // Get all the source links on that page
        for (let i = 0; i < countSource; i++) {
            const source = searchSources.locator('li').nth(i);
            const href = await source.locator('div.vlistentrymaincell a').first().getAttribute('href');
            if (href) { // Ensure href is not null
                linkStorage.push(`https://hojishinbun.hoover.org${href}`);
            } else {
                console.log(`The link does not exist for the ${i}th source on this page`)
            }
        }
    } catch (e) {
        console.error('Error during initial navigation or link scraping:', e);
    } 
    return linkStorage;
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

            // Finding other links we can navigate to
            const findNavLinks = await page.locator('.fullwidthwrapper #searchpagesearchresults nav .page-item a');
            const linksCount = await findNavLinks.count();
            console.log(`Total amount of pages that we can navigate towards${linksCount}`)


            // Collect the links
            let collectedLinks = await findLinks(page, [])
            res.push(...collectedLinks);

            // Collect the data
            console.log('Finding next links now')
            // If there are links to go to 
            if (linksCount && prevPage != currentPage) {
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
    const l = await autoSearch(browser, 'https://hojishinbun.hoover.org/?a=q&hs=1&r=1&results=1&txq=Negro&dafdq=&dafmq=&dafyq=&datdq=&datmq=&datyq=&puq=&ssnip=img&qp=1&e=-------en-10--1-byDA-img-negro-PAGE-----', 1)
    data = await findData(browser, l, data)
    
    let myuuid = uuidv4();
    const jsonData = JSON.stringify(data, null, 2); // Pretty-print JSON
    fs.writeFileSync(`output${myuuid}.json`, jsonData, 'utf8');
    console.log('JSON file created successfully!');

    await browser.close()
})();


/*
(async () => {
    const l = [
        "https://hojishinbun.hoover.org/?a=d&d=nbh19100710-01.1.6&srpos=132&e=-------en-10--131--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/en/newspapers/jan19121117-01.1.12",
        "https://hojishinbun.hoover.org/en/newspapers/jan19130223-01.1.12",
        "https://hojishinbun.hoover.org/en/newspapers/nys19130621-01.1.4",
        "https://hojishinbun.hoover.org/?a=d&d=jan19130907-01.1.6&srpos=3&e=-------en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/en/newspapers/jan19130914-01.1.8",
        "https://hojishinbun.hoover.org/en/newspapers/jan19131214-01.1.6",
        "https://hojishinbun.hoover.org/?a=d&d=tnw19190113-01.1.2&srpos=11&e=------191-en-10--11--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=osn19200101-01.1.3&srpos=90&e=-------en-10--81--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=lrh19210531-01.1.2&srpos=4&e=------192-en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=lrh19210809-01.1.2&srpos=13&e=------192-en-10--11--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=tnw19230428-01.1.3&srpos=2&e=-------en-10--1--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=tnj19250819-01.1.7&srpos=9&e=------192-en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19271120-01.1.8&srpos=17&e=------192-en-10--11--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nos19280217-01.1.1&srpos=24&e=------192-en-10--21--txt-nigger------",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19280808-01.1.1&srpos=74&e=-------en-10--71--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19290512-01.1.8&srpos=24&e=------192-en-10--21--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19290908-01.1.8&srpos=8&e=------192-en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nos19300617-01.1.1&srpos=22&e=------193-en-10--21--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19310719-01.1.8&srpos=68&e=------193-en-10--61--img-negro------",
        "https://hojishinbun.hoover.org/?a=q&qp=0&r=1&results=1&deq=193&e=-------en-10--11--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/en/newspapers/kam19330522-01.1.8",
        "https://hojishinbun.hoover.org/?a=d&d=jan19330913-01.1.1&srpos=133&e=------193-en-10--131--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19340923-01.1.1&srpos=8&e=------193-en-10--1--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=tnj19341027-01.1.9&srpos=37&e=------193-en-10--31--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19351124-01.1.8&srpos=35&e=-------en-10--31--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nws19360902-01.1.7&srpos=149&e=------193-en-10--141--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19361025-01.1.1&srpos=20&e=------193-en-10--11--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nws19361107-01.1.7&srpos=9&e=------193-en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19370719-01.1.3&srpos=13&e=-------en-10--11--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19371013-01.1.4&srpos=28&e=------193-en-10--21--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=tnj19380305-02.1.12&srpos=69&e=------193-en-10--61--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19380322-01.1.1&srpos=50&e=------193-en-10--41--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nws19380509-01.1.8&srpos=124&e=------193-en-10--121--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nws19381005-01.1.5&srpos=85&e=-------en-10--81--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=tdo19390405-01.1.4&srpos=42&e=------193-en-10--41--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19390503-01.1.5&srpos=110&e=------193-en-10--101--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nws19390926-01.1.2&srpos=58&e=-------en-10--51--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19400114-01.1.8&srpos=32&e=------194-en-10--31--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19400324-01&e=------194-en-10--21--img-negro----1940--",
        "https://hojishinbun.hoover.org/?a=d&d=kam19401118-01.1.5&srpos=25&e=------194-en-10--21--img-negro----1940--",
        "https://hojishinbun.hoover.org/?a=d&d=gnd19401212-01.1.8&srpos=20&e=------194-en-10--11--img-negro----1940--",
        "https://hojishinbun.hoover.org/?a=d&d=gnd19401221-01.1.8&srpos=13&e=------194-en-10--11--img-negro----1940--",
        "https://hojishinbun.hoover.org/?a=d&d=gnd19401226-01.1.5&srpos=11&e=------194-en-10--11--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=gnd19420110-01.1.1&srpos=19&e=------194-en-10--11--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=nws19410421-01.1.7&srpos=12&e=------194-en-10--11--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19410423-01.1.3&srpos=4&e=-------en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19410423-01.1.3&srpos=1&e=------194-en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19410622-01.1.7&srpos=40&e=------194-en-10--31--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19420106-01.1.6&srpos=47&e=------194-en-10--41--img-negro----1942--",
        "https://hojishinbun.hoover.org/?a=d&d=gnd19420323-01.1.1&srpos=19&e=------194-en-10--11--img-negro----1942--",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19421009-01.1.2&srpos=3&e=------194-en-10--1--img-%e9%bb%92%e3%82%93%e5%9d%8a------",
        "https://hojishinbun.hoover.org/?a=d&d=rks19431115-01.1.4&srpos=13&e=------194-en-10--11--img-negro----1943--",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19450723-01.1.4&srpos=12&e=------194-en-10--11--img-negro----1945--",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19460807-01.1.4&srpos=20&e=------194-en-10--11--img-negro----1946--",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19451024-01.1.4&srpos=35&e=------194-en-10--31--img-negro----1945--",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19461004-01.1.4&srpos=38&e=------194-en-10--31--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=csp19500315-01.1.1&srpos=17&e=------195-en-10--11--img-negro----1950--",
        "https://hojishinbun.hoover.org/?a=d&d=csp19510120-01.1.1&srpos=3&e=------195-en-10--1--img-negro----1951--",
        "https://hojishinbun.hoover.org/?a=d&d=ytn19510409-01.1.4&srpos=20&e=------195-en-10--11--img-negro----1951--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19521209-01.1.1&srpos=4&e=------195-en-10--1--img-negro----1952--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19540517-01.1.1&srpos=1&e=------195-en-10--1--img-negro----1954--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19541102-01.1.1&srpos=35&e=------195-en-10--31--img-negro----1954--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19570131-01.1.1&srpos=25&e=------195-en-10--21--img-negro----1957--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19570904-01.1.1&srpos=1&e=------195-en-10--1--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19570909-01.1.1&srpos=26&e=-------en-10--21--img-negro------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19590520-01.1.1&srpos=3&e=------195-en-10--1--img-negro----1959--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19590615-01.1.1&srpos=10&e=------195-en-10--1--img-negro----1959--",
        "https://hojishinbun.hoover.org/?a=d&d=tht19590616-01.1.2&srpos=25&e=------195-en-10--21--img-negro----1959--",
        "https://hojishinbun.hoover.org/?a=d&d=jan19131116-01.1.6&srpos=9&e=------191-en-10--1--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19130622-01.1.6&srpos=28&e=------191-en-10--21--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19130608-01.1.6&srpos=45&e=------191-en-10--41--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=tnj19191101-01.1.8&srpos=69&e=------191-en-10--61--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=tnj19260826-01.1.12&srpos=72&e=------192-en-10--71--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=lrh19210809-01.1.2&srpos=73&e=------192-en-10--71--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thh19690731-01.1.2&srpos=1&e=------196-en-10--1--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thh19690626-01.1.5&srpos=65&e=------196-en-10--61--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19681017-01.1.7&srpos=14&e=------196-en-10--11--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19730305-01.1.8&srpos=1&e=------197-en-10--1--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19730118-01.1.8&srpos=3&e=------197-en-10--1--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19700212-01.1.7&srpos=9&e=------197-en-10--1--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19760301-01.1.1&srpos=11&e=------197-en-10--11--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19720502-01.1.7&srpos=24&e=------197-en-10--21--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19720612-01.1.8&srpos=42&e=------197-en-10--41--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19760420-01.1.7&srpos=136&e=------197-en-10--131--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19370516-01.1.7&srpos=7&e=------193-en-10--1--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=tnj19330626-01.1.4&srpos=11&e=------193-en-10--11--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19400317-01.1.8&srpos=2&e=------194-en-10--1--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19520304-01.1.2&srpos=1&e=------195-en-10--1--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19670725-01.1.8&srpos=7&e=------196-en-10--1--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19680420-01.1.1&srpos=5&e=------196-en-10--1--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19600720-01.1.2&srpos=16&e=------196-en-10--11--img-%22black+people%22+OR+%22black+person%22+------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19700227-01.1.11&srpos=65&e=-------en-10--61--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19700629-01.1.7&srpos=72&e=-------en-10--71--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thi19811103-01.1.7&srpos=121&e=-------en-10--121--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19761206-01.1.2&srpos=200&e=-------en-10--191--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thh19720413-01.1.5&srpos=361&e=-------en-10--361--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=tht19760617-01.1.1&srpos=480&e=-------en-10--471--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=thh19810320-01.1.4&srpos=637&e=-------en-10--631--img-black------",
        "https://hojishinbun.hoover.org/?a=d&d=kam19350210-01.1.7&srpos=3&e=-------en-10--1--img-negto------",
        "https://hojishinbun.hoover.org/?a=d&d=jan19330330-01.1.1&srpos=10&e=-------en-10--1--img-negto------"
    ];
    var data = []
    const browser = await chromium.launch({ headless: true }); // Set to false if you want to see the browser
    data = await findData(browser, l, data)

    const jsonData = JSON.stringify(data, null, 2); // Pretty-print JSON
    fs.writeFileSync('output.json', jsonData, 'utf8');
    console.log('JSON file created successfully!');

    await browser.close()

})();
*/

export {findData, findLinks, autoSearch, findSingleData}