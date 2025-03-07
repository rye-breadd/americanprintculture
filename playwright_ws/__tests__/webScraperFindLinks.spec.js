import { chromium } from "playwright";
import { test, expect } from '@playwright/test';
import { findLinks } from "../webScraper";

test('tests to see if it collects all the links in the website')
