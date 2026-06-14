import sys
import os
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.ai_metadata import generate_ai_metadata, finalize_metadata
try:
    from openai import OpenAI
except ImportError:
    print("OpenAI library not installed")
    sys.exit(1)

def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY environment variable not set. Please set it or run this script from your configured environment.")
        return

    client = OpenAI()
    
    contexts = [
        {"kills": 4, "site_name": "A Site", "agent_name": "Jett", "weapon": "Operator", "headshots": 2},
        {"kills": 1, "site_name": "Mid", "agent_name": "Chamber", "weapon": "Sheriff", "headshots": 1},
        {"kills": 3, "site_name": "B Site", "agent_name": "Omen", "weapon": "Vandal", "headshots": 1},
        {"kills": 2, "site_name": "C Site", "agent_name": "Reyna", "weapon": "Phantom", "headshots": 0},
        {"kills": 5, "site_name": "A Site", "agent_name": "Neon", "weapon": "Judge", "headshots": 0},
        {"kills": 1, "site_name": "", "agent_name": "Killjoy", "weapon": "Classic", "headshots": 1},
        {"kills": 2, "site_name": "A Site", "agent_name": "Sova", "weapon": "Odin", "headshots": 1},
        {"kills": 3, "site_name": "B Site", "agent_name": "Phoenix", "weapon": "Vandal", "headshots": 3},
        {"kills": 4, "site_name": "Mid", "agent_name": "Cypher", "weapon": "Operator", "headshots": 0},
        {"kills": 2, "site_name": "A Site", "agent_name": "Viper", "weapon": "Spectre", "headshots": 1},
    ]

    print("# Generated AI Metadata Test\n")
    for i, ctx in enumerate(contexts, 1):
        try:
            raw = generate_ai_metadata(
                client=client,
                model="gpt-4o-mini",
                file_path=Path(f"test_clip_{i}.mp4"),
                rel_path=f"test_clip_{i}.mp4",
                channel_name="GanpatiGamerBoi",
                extra_keywords=["valorant"],
                language="en",
                recent_titles=[],
                recent_descriptions=[],
                clip_context=ctx
            )
            final = finalize_metadata(raw, raw, instagram_username="renuka.1196")
            print(f"## Test {i}: {ctx.get('agent_name')} with {ctx.get('weapon')} ({ctx.get('kills')} kills)")
            print(f"**Title:** {final['title']}")
            print(f"**Description:** {final['description']}")
            print(f"**Tags:** {', '.join(final['tags'][:5])}...")
            print("-" * 40)
        except Exception as e:
            print(f"Error on test {i}: {e}")

if __name__ == '__main__':
    main()
