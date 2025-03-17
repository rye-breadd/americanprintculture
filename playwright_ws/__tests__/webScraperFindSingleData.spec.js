import { chromium } from "playwright";
import { test, expect } from '@playwright/test';
import { findSingleData } from "../webScraper";

test('Finds the data in a single link', async({ browser }) => {
    const testLink = 'https://hojishinbun.hoover.org/?a=d&d=csn18820405-01.1.5&srpos=1&e=-------en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------';
    const testPage = await browser.newPage();
    await testPage.goto(testLink)


    const result  = await findSingleData(testPage, );

    expect(result[0].link).toBe('https://hojishinbun.hoover.org/?a=d&d=csn18820405-01.1.5&srpos=1&e=-------en-10--1-byDA-img-%e4%ba%8c%e4%b8%96------')
    expect(result[0].numWords).toBe(1)
    expect(result[0].paragraphs.length).toBe(4)
});