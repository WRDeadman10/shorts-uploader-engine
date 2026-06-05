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
        files = [f for f in files if "converted_shorts" not in f and "test_output" not in f and "test_moviepy" not in f]
        if files:
            return files[0]
    return None

def probe_duration(filepath):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filepath]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except:
        return 60.0

def main():
    source = find_test_video()
    if not source:
        print("Could not find a test video.")
        return
        
    print(f"Using source: {source}")
    output = "test_layout_enhanced.mp4"
    
    if not os.path.exists('impact.ttf'):
        shutil.copy2('C:\\Windows\\Fonts\\impact.ttf', 'impact.ttf')

    # Calculate exact duration so we know when to trigger the fade-out
    duration = min(60.0, probe_duration(source))
    fade_out_start = max(0, duration - 0.5)

    # NEW ENHANCEMENTS ADDED:
    # 1. eq=saturation=1.4:contrast=1.05  (Color Pop on the foreground)
    # 2. fade=t=in & fade=t=out           (Smooth 0.5s fade to black)
    # 3. loudnorm & afade                 (Audio Normalization & audio fade)

    filter_complex = (
        "[0:v]split=2[bg_src][fg_raw];"
        "[bg_src]scale=270:-1,boxblur=5:5,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];"
        "[fg_raw]eq=saturation=1.4:contrast=1.05:gamma=1.05[fg_pop];"
        "[fg_pop]scale=-1:1500,crop=1080:1500[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2[composed];"
        f"[composed]drawtext=text='ENHANCED VERSION':fontcolor=black:fontsize=120:fontfile=impact.ttf:x=(w-text_w)/2:y=60[with_text];"
        f"[with_text]fade=t=in:st=0:d=0.5,fade=t=out:st={fade_out_start:.3f}:d=0.5[outv];"
        f"[0:a]loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.5,afade=t=out:st={fade_out_start:.3f}:d=0.5[outa]"
    )
    
    cmd = [
        "ffmpeg", "-y",
        "-i", source,
        "-t", f"{duration:.3f}",
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264", 
        "-preset", "fast",
        "-c:a", "aac",
        output
    ]
    
    print(f"Running FFmpeg (Duration: {duration:.1f}s)...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print("FFmpeg failed!")
        print(result.stderr)
    else:
        print(f"Success! Enhanced test video saved to {os.path.abspath(output)}")

if __name__ == '__main__':
    main()
