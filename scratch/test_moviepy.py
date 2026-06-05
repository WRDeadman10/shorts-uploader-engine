from moviepy import VideoFileClip, TextClip, CompositeVideoClip, ColorClip
import os
import glob
import shutil

def find_test_video():
    paths = [
        r"E:\New folder\Valorant Tracker\VALORANT\**\*.mp4",
        r"C:\Users\winss\Documents\Projects\**\*.mp4"
    ]
    for p in paths:
        files = glob.glob(p, recursive=True)
        files = [f for f in files if "converted_shorts" not in f and "test_output" not in f]
        if files:
            return files[0]
    return None

def main():
    source = find_test_video()
    if not source:
        print("No test video found.")
        return

    print(f"Loading video: {source}")
    
    # 1. Load the video and trim to 60 seconds (or clip duration)
    clip = VideoFileClip(source)
    duration = min(60.0, clip.duration)
    clip = clip.subclipped(0, duration)
    
    # 2. Scale foreground to height=1500, then crop width to 1080 (Center crop)
    fg_clip = clip.resized(height=1500)
    fg_clip = fg_clip.cropped(x_center=fg_clip.w / 2, y_center=fg_clip.h / 2, width=1080, height=1500)
    fg_clip = fg_clip.with_position("center")

    # 3. Background: We use a sleek dark gray color instead of a heavy blur to keep the render speed reasonable
    bg_clip = ColorClip(size=(1080, 1920), color=(15, 15, 20), duration=duration)

    # 4. Text Overlay with slide-in animation!
    if not os.path.exists('impact.ttf'):
        shutil.copy2('C:\\Windows\\Fonts\\impact.ttf', 'impact.ttf')

    text_clip = TextClip(
        font='impact.ttf', 
        text='DYNAMIC SLIDING TEXT!', 
        font_size=90, 
        color='white', 
        stroke_color='red', 
        stroke_width=3
    ).with_duration(duration)

    # The magic of MoviePy: Math-driven animations!
    # Let's make the text slide down smoothly from the top over the first 1.5 seconds.
    def text_pos(t):
        if t < 1.5:
            # Easing function (cubic ease-out)
            progress = 1 - (1 - t/1.5)**3
            y_pos = 0 + (100 * progress)
        else:
            y_pos = 100
        return ('center', y_pos)

    text_clip = text_clip.with_position(text_pos)

    # 5. Composite all layers together like a timeline
    final_video = CompositeVideoClip([bg_clip, fg_clip, text_clip])

    # 6. Render
    print("Rendering with MoviePy... (this will take a few minutes since we are rendering 60 seconds)")
    final_video.write_videofile(
        "test_moviepy_output.mp4", 
        fps=30, # downsample to 30fps to speed up rendering
        preset="fast",
        codec="libx264",
        audio_codec="aac"
    )
    print("Done! Saved to test_moviepy_output.mp4")

if __name__ == '__main__':
    main()
