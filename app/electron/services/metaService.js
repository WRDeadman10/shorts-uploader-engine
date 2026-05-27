const https = require('https');
const fs = require('fs');
const path = require('path');
const { getRepoRoot } = require('./pathService');

function updateMetaToken(userToken, targetPageId, graphVersion = 'v25.0') {
    if (!userToken || !targetPageId) return Promise.resolve();

    return new Promise((resolve) => {
        const url = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D&access_token=${userToken}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.data) {
                        for (const account of parsed.data) {
                            if (String(account.id) === String(targetPageId)) {
                                const pageToken = account.access_token;
                                const igUserId = account.instagram_business_account ? account.instagram_business_account.id : "";
                                const pageName = account.name || "";
                                
                                if (pageToken) {
                                    const cachePath = path.join(getRepoRoot(), '.meta_auth_cache.json');
                                    let cache = {};
                                    try {
                                        if (fs.existsSync(cachePath)) {
                                            cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                                        }
                                    } catch (e) {}
                                    
                                    cache[targetPageId] = {
                                        page_access_token: pageToken,
                                        ig_user_id: igUserId,
                                        page_name: pageName
                                    };
                                    
                                    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
                                    console.log("[meta_api] Token seamlessly updated on app startup");
                                }
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse Meta API response on startup", e);
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error("Failed to call Meta API on startup", err);
            resolve();
        });
    });
}

module.exports = { updateMetaToken };
