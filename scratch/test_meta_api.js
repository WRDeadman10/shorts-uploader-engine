const fs = require('fs');
const path = require('path');
const https = require('https');

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
                    resolve({ error: { message: `HTTP status ${res.statusCode}: failed to parse JSON` } });
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function run() {
    try {
        const settingsPath = path.join(__dirname, '..', 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            console.error('settings.json not found at', settingsPath);
            return;
        }
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const uploadOpts = settings.uploadOptions || {};
        const accessToken = uploadOpts.metaAccessToken;
        const igUserId = uploadOpts.igUserId;
        const graphVersion = uploadOpts.metaGraphVersion || "v25.0";

        if (!accessToken || !igUserId) {
            console.error('AccessToken or igUserId is missing in settings.json');
            return;
        }

        console.log('Using Instagram User ID:', igUserId);
        console.log('Using Graph Version:', graphVersion);

        // Fetch media with default query
        const url = `https://graph.facebook.com/${graphVersion}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments{id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}}&limit=100&access_token=${accessToken}`;
        console.log('Fetching URL...');
        const response = await fetchUrl(url);

        if (response.error) {
            console.error('API Error:', response.error);
            return;
        }

        const posts = response.data || [];
        console.log(`Successfully fetched ${posts.length} posts.`);
        
        posts.forEach((post, i) => {
            const commentsCount = post.comments?.data?.length || 0;
            console.log(`Post [${i}]: ID=${post.id}, Caption="${post.caption ? post.caption.substring(0, 40) : ''}", CommentsCount=${commentsCount}`);
        });

        // Save detailed response for inspection
        const outputPath = path.join(__dirname, 'meta_api_response.json');
        fs.writeFileSync(outputPath, JSON.stringify(response, null, 2), 'utf8');
        console.log('Detailed response saved to:', outputPath);

    } catch (e) {
        console.error('Error running test:', e);
    }
}

run();
