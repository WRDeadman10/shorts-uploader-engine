from lib.meta_api import fb_finish_reel_publish
import responses
import pytest
import time
from unittest.mock import patch

@responses.activate
def test_fb_finish_reel_publish_retries():
    print("Testing fb_finish_reel_publish retry logic...")
    
    url = "https://graph.facebook.com/v25.0/page123/video_reels"
    
    error_payload = {
        "error": {
            "message": "There was a problem uploading your video file. Please try again with another file.",
            "type": "OAuthException",
            "code": 6000
        }
    }
    success_payload = {"id": "target_post_id"}
    
    # 1. Mock failure, then success
    responses.add(responses.POST, url, json=error_payload, status=400)
    responses.add(responses.POST, url, json=success_payload, status=200)
    
    # Speed up sleep
    with patch('time.sleep', return_value=None):
        result = fb_finish_reel_publish(
            page_id="page123",
            access_token="token",
            video_id="vid123",
            description="desc"
        )
        
    print(f"Result: {result}")
    if result == "target_post_id" and len(responses.calls) == 2:
        print("SUCCESS: Function retried on specific error and eventually succeeded.")
        return 0
    else:
        print(f"FAILURE: Unexpected result ({result}) or call count ({len(responses.calls)})")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(test_fb_finish_reel_publish_retries())
