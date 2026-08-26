"""
视频转码服务

## 为什么需要

iPhone 拍摄 / 相册里的 `.mov` 通常是 **HEVC (H.265) + QuickTime 容器**。
这种格式在浏览器 `<video>`（Chrome/Firefox 基本不支持 MOV/HEVC）和不少
Android 设备上无法播放，导致「线上播不了」。这里在上传入口做一次归一化：
把所有视频统一转成 **H.264 + AAC 的 MP4，并 `+faststart`**（moov atom 前置，
支持边下边播 / HTTP Range 流式播放），保证 iOS App / Android / Web 全端可播。

## 策略

1. `ffprobe` 探测视频/音频编码。
2. 已经是 H.264 (+AAC/无音轨) → 只做 **remux + faststart**（`-c copy`，秒级、无损）。
3. 其它（HEVC / MOV / 其它编码）→ **完整转码** libx264 + aac，
   顺带把长边限制到 1080p 以内压缩体积（当前上传链路对视频没有任何压缩）。

ffmpeg 是 CPU 密集型操作，调用方必须用 `asyncio.to_thread` 包起来跑，
避免阻塞事件循环。
"""
import json
import os
import shutil
import subprocess
import tempfile
from typing import Optional

# 转码后统一输出的容器 / 编码
OUTPUT_EXT = "mp4"
OUTPUT_CONTENT_TYPE = "video/mp4"

# 长边像素上限。手机竖屏视频常见 1080x1920，这里把长边限制到 1920，
# 4K 素材会被降到 1080p，既够清晰又能显著压缩体积。
_MAX_LONG_EDGE = 1920

# ffmpeg 单次转码硬超时（秒）。前端 XHR 上传超时是 300s，这里留足余量。
_FFMPEG_TIMEOUT_S = 240


class VideoTranscodeError(Exception):
    """转码失败（ffmpeg 不存在、探测失败、编码报错等）。"""


def is_ffmpeg_available() -> bool:
    """运行环境是否装了 ffmpeg + ffprobe。"""
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _probe_codecs(path: str) -> tuple[Optional[str], Optional[str]]:
    """返回 (video_codec, audio_codec)，取不到的为 None。"""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "stream=codec_type,codec_name",
                "-of", "json", path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (subprocess.SubprocessError, OSError) as e:
        raise VideoTranscodeError(f"ffprobe 执行失败: {e}") from e

    if result.returncode != 0:
        raise VideoTranscodeError(f"ffprobe 探测失败: {result.stderr.strip()}")

    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    try:
        streams = json.loads(result.stdout).get("streams", [])
    except json.JSONDecodeError as e:
        raise VideoTranscodeError(f"ffprobe 输出解析失败: {e}") from e

    for stream in streams:
        codec_type = stream.get("codec_type")
        codec_name = stream.get("codec_name")
        if codec_type == "video" and video_codec is None:
            video_codec = codec_name
        elif codec_type == "audio" and audio_codec is None:
            audio_codec = codec_name

    if video_codec is None:
        raise VideoTranscodeError("文件不含视频流")

    return video_codec, audio_codec


def _run_ffmpeg(args: list[str]) -> None:
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args],
            capture_output=True,
            text=True,
            timeout=_FFMPEG_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired as e:
        raise VideoTranscodeError("ffmpeg 转码超时") from e
    except (subprocess.SubprocessError, OSError) as e:
        raise VideoTranscodeError(f"ffmpeg 执行失败: {e}") from e

    if result.returncode != 0:
        raise VideoTranscodeError(f"ffmpeg 转码失败: {result.stderr.strip()}")


def transcode_to_mp4(content: bytes, original_filename: str | None) -> bytes:
    """
    把上传的视频字节归一化为 H.264/AAC MP4 (+faststart) 并返回新字节。

    调用方需用 `asyncio.to_thread` 包裹。若 ffmpeg 不可用，抛
    `VideoTranscodeError`，由路由层决定降级（原样存储）还是拒绝。
    """
    if not is_ffmpeg_available():
        raise VideoTranscodeError("运行环境未安装 ffmpeg/ffprobe")

    suffix = ""
    if original_filename and "." in original_filename:
        suffix = "." + original_filename.rsplit(".", 1)[-1].lower()

    tmp_dir = tempfile.mkdtemp(prefix="avant_video_")
    src_path = os.path.join(tmp_dir, f"input{suffix or '.bin'}")
    out_path = os.path.join(tmp_dir, f"output.{OUTPUT_EXT}")

    try:
        with open(src_path, "wb") as f:
            f.write(content)

        video_codec, audio_codec = _probe_codecs(src_path)

        already_h264 = video_codec == "h264"
        audio_ok = audio_codec in (None, "aac")

        if already_h264 and audio_ok:
            # 无损 remux：只把 moov atom 前置，几乎不耗 CPU。
            _run_ffmpeg([
                "-i", src_path,
                "-c", "copy",
                "-movflags", "+faststart",
                out_path,
            ])
        else:
            # 完整转码：H.264 + AAC，长边限制到 1080p 以内。
            # scale='min(1920,iw)':-2 —— 只在超宽时缩小，-2 自动保持偶数高度。
            _run_ffmpeg([
                "-i", src_path,
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "23",
                "-pix_fmt", "yuv420p",
                "-vf", f"scale='min({_MAX_LONG_EDGE},iw)':-2",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                out_path,
            ])

        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
