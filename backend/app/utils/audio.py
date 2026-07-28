import os
import subprocess
import shutil
from pathlib import Path

def get_ffmpeg_path() -> str:
    """Returns the absolute executable path of FFmpeg, checking PATH and local winget install."""
    sys_path = shutil.which("ffmpeg")
    if sys_path:
        return sys_path
        
    # Check default Windows Winget installer folder
    user_profile = os.environ.get("USERPROFILE", r"C:\Users\DISHITA RAWAT")
    winget_ffmpeg = Path(user_profile) / r"AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe"
    if winget_ffmpeg.exists():
        return str(winget_ffmpeg)
        
    return "ffmpeg"

def get_ffprobe_path() -> str:
    """Returns the absolute executable path of FFprobe, checking PATH and local winget install."""
    sys_path = shutil.which("ffprobe")
    if sys_path:
        return sys_path
        
    # Check default Windows Winget installer folder
    user_profile = os.environ.get("USERPROFILE", r"C:\Users\DISHITA RAWAT")
    winget_ffprobe = Path(user_profile) / r"AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffprobe.exe"
    if winget_ffprobe.exists():
        return str(winget_ffprobe)
        
    return "ffprobe"

def is_ffmpeg_installed() -> bool:
    """Checks if FFmpeg is available on the system PATH or winget folder."""
    path = get_ffmpeg_path()
    if path != "ffmpeg":
        return True
    return shutil.which("ffmpeg") is not None

def convert_to_mp3(input_path: Path, mp3_path: Path):
    """
    Executes a subprocess to call FFmpeg, converting the input file (e.g., MP4, WAV)
    into a compressed MP3 audio file.
    """
    if not is_ffmpeg_installed():
        raise RuntimeError(
            "FFmpeg is not installed or not available in the system PATH. "
            "Please install FFmpeg to enable audio extraction and conversion."
        )
    
    cmd = [
        get_ffmpeg_path(),
        "-y",                 # Overwrite output files without asking
        "-i", str(input_path),# Input file path
        "-vn",                # Disable video recording (safely ignored for audio files)
        "-acodec", "libmp3lame", # MP3 encoder
        "-q:a", "2",          # Variable Bit Rate (VBR) quality level 2 (approx 190 kbps)
        str(mp3_path)         # Output file path
    ]
    
    try:
        # Run conversion synchronously
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or "Unknown FFmpeg processing error."
        raise RuntimeError(f"FFmpeg conversion failed: {error_msg}")
    except Exception as e:
        raise RuntimeError(f"FFmpeg execution failed: {str(e)}")

def get_audio_duration(file_path: Path) -> float:
    """
    Retrieves the duration of an audio file in seconds using ffprobe.
    """
    ffprobe_cmd = get_ffprobe_path()
    
    # Verify binary exists or can be resolved
    if ffprobe_cmd == "ffprobe" and not shutil.which("ffprobe"):
        return 0.0
    
    cmd = [
        ffprobe_cmd,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file_path)
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        print(f"[Duration Error] Failed to read audio duration using ffprobe: {e}")
        return 0.0
