const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('error', err => console.log('PAGE ERROR EVENT:', err.message));

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('button'));
      const uploadLink = links.find(el => el.textContent === 'Upload');
      if (uploadLink) {
          console.log('Found upload link, clicking...');
          uploadLink.click();
      } else {
          console.log('Upload link not found');
      }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log("DOM HTML LENGTH:", html.length);
  if (html.length < 2000) {
      console.log("DOM HTML SNIPPET:\n", html);
  } else {
      console.log("DOM HTML SNIPPET:\n", html.substring(0, 3000));
  }
  
  await browser.close();
})();
