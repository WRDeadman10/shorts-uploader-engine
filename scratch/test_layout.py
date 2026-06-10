import os
import subprocess
import glob
import shutil

def find_test_video():
    paths = [
        r"E:\New folder\Valorant Tracker\VALORANT\**\*.mp4",
        r"C:\Users\winss\Documents\Projects\**\*.mp4"
    ]
    for p in paths:
        files = glob.glob(p, recursive=True)
        files = [f for f in files if "converted_shorts" not in f and "test_output" not in f and "test_moviepy" not in f and "test_fact" not in f and "test_layout" not in f]
        if files:
            return files[0]
    return None

def main():
    source = find_test_video()
    if not source:
        print("Could not find a test video.")
        return
        
    print(f"Using source: {source}")
    output = "test_output.mp4"
    
    # We only need 15 seconds for testing
    duration = 15.0

    filter_complex = (
        "[0:v]split=2[bg_src][fg_raw];"
        "[bg_src]scale=270:-1,boxblur=5:5,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];"
        "[fg_raw]eq=saturation=1.4:contrast=1.05:gamma=1.05[fg_pop];"
        "[fg_pop]scale=-1:1500,crop=1080:1500[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]"
    )
    
    cmd = [
        "ffmpeg", "-y",
        "-i", source,
        "-t", str(duration),
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "0:a?",
        "-c:v", "libx264", "-crf", "23", "-preset", "fast",
        "-c:a", "aac", "-b:a", "192k",
        output
    ]
    
    print(f"Running ffmpeg to create clean {output}...")
    subprocess.run(cmd)

if __name__ == "__main__":
    main()
