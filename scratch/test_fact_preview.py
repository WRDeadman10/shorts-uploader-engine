import urllib.request
import json
import textwrap
import subprocess
from pathlib import Path

def fetch_fact():
    try:
        req = urllib.request.Request("https://uselessfacts.jsph.pl/api/v2/facts/random", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            fact_data = json.loads(response.read().decode())
            return fact_data.get("text", "Default fact.")
    except Exception as e:
        print(f"Error: {e}")
        return "Error fetching fact."

def generate_preview():
    fact = fetch_fact()
    print("Fact:", fact)
    
    # Strip non-ascii to prevent empty square boxes for emojis
    fact = fact.encode("ascii", "ignore").decode("ascii")
    fact = fact.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"').replace('\r', '').replace('\n', ' ')
        
    wrapped_lines = textwrap.wrap(fact, width=45)
    
    with open("test_fact.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(wrapped_lines))
        
    fontfile = "impact.ttf"
    
    input_vid = "test_output.mp4"
    if not Path(input_vid).exists():
        input_vid = "color=c=gray:s=1080x1920:d=4"
        input_arg = ["-f", "lavfi", "-i", input_vid]
    else:
        # Use only first 4 seconds
        input_arg = ["-i", input_vid, "-t", "4"]
    
    filter_complex = (
        f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
        f"drawtext=textfile=test_fact.txt:fontcolor=white:fontsize=40:fontfile={fontfile}:"
        f"x=(w-text_w)/2:y=50:box=1:boxcolor=black@0.6:boxborderw=30:line_spacing=1:text_align=C[outv]"
    )
    
    cmd = [
        "ffmpeg", "-y", *input_arg,
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "scratch/test_fact_preview.mp4"
    ]
    
    subprocess.run(cmd)

if __name__ == "__main__":
    generate_preview()
