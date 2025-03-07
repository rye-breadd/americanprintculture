import { chromium } from "playwright";
import { test, expect } from '@playwright/test';
import { autoSearch } from "../webScraper";

test('Integration Testing of the entire webscraper on pages and to the end', async({ browser}) => {
    const x = await autoSearch(browser, 'https://hojishinbun.hoover.org/?a=q&qp=0&r=1&results=1&e=------189-en-10--31--img-%e4%ba%8c%e4%b8%96------')
    console.log(x)
});

test('Integration Testing of a page with no other navigation links', async({ browser }) => {
    await autoSearch(browser, 'https://hojishinbun.hoover.org/?a=q&qp=0&r=1&results=1&yeq=1891&e=------189-en-10--31--img-%e4%ba%8c%e4%b8%96------')
});
