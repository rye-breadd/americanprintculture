import { chromium } from "playwright";
import { test, expect } from '@playwright/test';
import { findData, autoSearch } from "../webScraper";


test('findData should create a JSON file with the data required', async ({ browser }) => {
    console.log('finding data')
    const testLink = 'https://hojishinbun.hoover.org/?a=d&d=csn18820405-01.1.5&srpos=1&e=-------en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------';
    const linkStorage = [testLink]
    const storage = [];

    const result  = await findData(browser, linkStorage, storage);

    expect(result[0].link).toBe('https://hojishinbun.hoover.org/?a=d&d=csn18820405-01.1.5&srpos=1&e=-------en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------')
    expect(result[0].numWords).toBe(1)
    expect(result[0].pdfName).toContain(".pdf")
    console.log(result)
});
 
test('findData should collect data for more than 3+ links', async ({ browser }) => {
    const testLink1 = 'https://hojishinbun.hoover.org/?a=d&d=csn18820405-01.1.5&srpos=1&e=-------en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------';
    const testLink2 = 'https://hojishinbun.hoover.org/?a=d&d=tnj19100114-01.1.7&srpos=8&e=------191-en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------'
    const testLink3 = 'https://hojishinbun.hoover.org/?a=d&d=tnj19100117-01.1.4&srpos=9&e=------191-en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------'
    const linkStorage = [testLink1, testLink2, testLink3]
    const storage = [];

    const result  = await findData(browser, linkStorage, storage);

    expect(result.length).toBe(3)
});

    