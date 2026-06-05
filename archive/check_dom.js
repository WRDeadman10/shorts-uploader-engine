const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  
  // Wait a bit just in case React takes a moment to mount
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on the 'Upload' tab in the sidebar if it exists to navigate to the blank page!
  try {
      await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button, div'));
          const uploadLink = links.find(el => el.innerText && el.innerText.includes('Upload'));
          if (uploadLink) uploadLink.click();
      });
      await new Promise(r => setTimeout(r, 2000));
  } catch(e) {}
  
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log("DOM HTML LENGTH:", html.length);
  if (html.length < 2000) {
      console.log("DOM HTML SNIPPET:\n", html);
  } else {
      console.log("DOM HTML SNIPPET (First 2000 chars):\n", html.substring(0, 2000));
  }
  
  await browser.close();
})();
