import json
import os
import requests

def main():
    settings_path = "settings.json"
    if not os.path.exists(settings_path):
        settings_path = "../settings.json"
        
    with open(settings_path, "r", encoding="utf-8") as f:
        settings = json.load(f)
        
    upload_opts = settings.get("uploadOptions", {})
    access_token = upload_opts.get("metaAccessToken")
    ig_user_id = upload_opts.get("igUserId")
    graph_version = upload_opts.get("metaGraphVersion", "v25.0")
    
    if not access_token or not ig_user_id:
        print("Error: Missing credentials")
        return
        
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media"
    params = {
        "fields": "id,caption,comments{id,text,username}",
        "limit": 100,
        "access_token": access_token
    }
    
    print("Fetching media with nested comments...")
    res = requests.get(url, params=params)
    if res.status_code != 200:
        print(f"Error: {res.status_code} - {res.text}")
        return
        
    data = res.json().get("data", [])
    print(f"Total media fetched: {len(data)}")
    
    posts_with_comments = []
    for item in data:
        comments_obj = item.get("comments")
        if comments_obj:
            c_data = comments_obj.get("data", [])
            if c_data:
                posts_with_comments.append((item.get("id"), len(c_data), item.get("caption", "")[:40]))
                
    print(f"Found {len(posts_with_comments)} posts containing nested comments in the response:")
    for pid, count, caption in posts_with_comments:
        print(f"  - Post ID {pid} has {count} nested comments. Caption: '{caption}'")

if __name__ == "__main__":
    main()
