"""Batch-upload YouTube Shorts with AI-generated metadata.

Setup:
1) Create YouTube API OAuth credentials and download `client_secret.json`.
2) Set `OPENAI_API_KEY` in your environment for AI metadata generation.
3) Install dependencies:
   pip install google-api-python-client google-auth-oauthlib google-auth-httplib2 openai

Example:
python youtubeBatchUpload.py --root "." --max-videos 10 --privacy public
"""

from __future__ import annotations

import sys
from lib.cli_args import parse_args
from lib.upload_loop import main as upload_main

def main() -> int:
    args = parse_args()
    return upload_main(args)

if __name__ == "__main__":
    sys.exit(main())
