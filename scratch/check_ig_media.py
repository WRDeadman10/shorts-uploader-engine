import json
import os
import requests

def main():
    # Load settings.json
    settings_path = "../settings.json"
    if not os.path.exists(settings_path):
        # try in root Cwd
        settings_path = "settings.json"
        
    with open(settings_path, "r", encoding="utf-8") as f:
        settings = json.load(f)
        
    upload_opts = settings.get("uploadOptions", {})
    access_token = upload_opts.get("metaAccessToken")
    ig_user_id = upload_opts.get("igUserId")
    graph_version = upload_opts.get("metaGraphVersion", "v25.0")
    
    if not access_token or not ig_user_id:
        print("Error: Missing metaAccessToken or igUserId in settings.json")
        return
        
    print(f"IG User ID: {ig_user_id}")
    print(f"Graph Version: {graph_version}")
    
    # 1. Query media list
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media"
    params = {
        "fields": "id,caption,media_type,media_product_type,permalink,timestamp",
        "limit": 100,
        "access_token": access_token
    }
    
    print("Fetching media...")
    res = requests.get(url, params=params)
    if res.status_code != 200:
        print(f"Failed to fetch media: {res.status_code} - {res.text}")
        return
        
    data = res.json().get("data", [])
    print(f"Fetched {len(data)} media items.")
    
    for idx, item in enumerate(data[:10]):
        print(f"{idx+1}. Media ID: {item.get('id')} | Type: {item.get('media_type')} | Product: {item.get('media_product_type')} | Date: {item.get('timestamp')}")
        print(f"   Caption: {item.get('caption', '')[:100]}")
        
    # Check if there are comments on any of them
    print("\nChecking comments on all fetched media...")
    media_with_comments = 0
    for item in data:
        media_id = item.get("id")
        comments_url = f"https://graph.facebook.com/{graph_version}/{media_id}/comments"
        c_params = {
            "fields": "id,text,username,timestamp",
            "access_token": access_token
        }
        c_res = requests.get(comments_url, params=c_params)
        if c_res.status_code == 200:
            c_data = c_res.json().get("data", [])
            if c_data:
                media_with_comments += 1
                print(f"Media {media_id} has {len(c_data)} comments:")
                for comment in c_data:
                    print(f"  - @{comment.get('username')}: {comment.get('text')}")
        else:
            print(f"Failed to fetch comments for {media_id}: {c_res.status_code}")

if __name__ == "__main__":
    main()
