const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    resolve({ error: { message: `HTTP status ${res.statusCode}: failed to parse JSON: ${err.message}` }, raw: data });
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
    const uploadOpts = settings.uploadOptions || {};
    const accessToken = uploadOpts.metaAccessToken;
    const igUserId = uploadOpts.igUserId;
    const graphVersion = uploadOpts.metaGraphVersion || "v25.0";

    const url = `https://graph.facebook.com/${graphVersion}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments{id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}}&limit=100&access_token=${accessToken}`;
    
    console.log("Calling fetchUrl...");
    const res = await fetchUrl(url);
    if (res.error) {
        console.log("Error returned:", res.error);
        console.log("Raw response length:", res.raw?.length);
        console.log("Snippet of raw response:", res.raw?.slice(0, 500));
        return;
    }

    const data = res.data || [];
    console.log("Successfully parsed JSON!");
    console.log(`Fetched ${data.length} media items.`);
    
    const postsWithComments = data.filter(p => p.comments && p.comments.data && p.comments.data.length > 0);
    console.log(`Found ${postsWithComments.length} posts with comments in Node.js:`);
    postsWithComments.forEach(p => {
        console.log(`  - Post ID ${p.id} has ${p.comments.data.length} comments. Caption: '${p.caption?.slice(0, 30)}'`);
    });
}

main().catch(console.error);
