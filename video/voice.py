"""Narration for the Verdict demo video: one WAV per scene, Piper voice en_US-ryan-high, run locally.

Run with a Python that has piper-tts (D:/claude/beneficia/.venv). edge-tts answers HTTP 403 since 2026-10-11.
Writes video/voice/<scene>.wav and video/voice/durations.json (seconds per scene).
Every number spoken here is measured: see docs/video-script.md for where each one comes from.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
VOICE = Path("D:/claude/beneficia/video/piper/en_US-ryan-high.onnx")
LENGTH_SCALE = "1.0"
OUT = HERE / "voice"

SCENES = {
    "title": "Verdict. Find out if a skincare product works on your skin, before the return window closes.",
    "problem": "Labels promise results on a schedule. Nearly half of six hundred and thirty three skincare brands "
               "could not back any key claim with evidence a shopper can check. And we find out after the return "
               "window has closed.",
    "scan": "Photograph the label. Claude reads each claim and matches it to what YouCam AI Skin Analysis measures. "
            "A claim a photo cannot check is shown, with the reason, and left out.",
    "claim": "I add the hydration claim from the same label. A photo can check hydration.",
    "purchase": "Then the price and the return window. Check-ins are planned so the verdict lands before the deadline.",
    "capture": "Day zero is two photos, one right after the other, through YouCam's camera kit, which checks light, "
               "framing and angle live. These are synthetic test faces, never a real person.",
    "baseline": "Each photo goes from the phone straight to YouCam Skin Analysis, in HD. The difference between the two "
                "readings is your own noise floor.",
    "demo": "This is my own trial, running now: a thirty dollar cream, a thirty day window, a check-in every week. "
            "Numbers only. No face photo is published.",
    "verdict": "On verdict day, each claim gets a result next to its threshold. Here, hydration moved two tenths of a "
               "point, inside a band of three point four. No measurable change, so the suggestion is: return it, "
               "while the refund is still possible.",
    "rawscore": "Verdict judges on YouCam's raw scores. The display scores ran up to forty points higher in our tests, "
                "and would flatter any product.",
    "compare": "Compare day zero and verdict day with YouCam's detection masks.",
    "privacy": "Face photos stay on the phone. If redness or blemishes keep rising, Verdict suggests pausing and seeing "
               "a dermatologist. It never diagnoses.",
    "closing": "Verdict. Measured on your skin, decided before the deadline.",
}


def ffprobe() -> Path:
    return next(Path("C:/Users/Anas/AppData/Local/Microsoft/WinGet/Packages").glob("Gyan.FFmpeg*/*/bin")) / "ffprobe.exe"


def duration(path: Path) -> float:
    out = subprocess.run([str(ffprobe()), "-v", "error", "-show_entries", "format=duration", "-of",
                          "default=nw=1:nk=1", str(path)], capture_output=True, text=True).stdout
    return round(float(out.strip()), 2)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    durations = {}
    for name, text in SCENES.items():
        path = OUT / f"{name}.wav"
        subprocess.run([sys.executable, "-m", "piper", "-m", str(VOICE), "--length-scale", LENGTH_SCALE,
                        "--sentence-silence", "0.25", "-f", str(path)], input=text.encode("utf-8"), check=True,
                       capture_output=True)
        durations[name] = duration(path)
    (OUT / "durations.json").write_text(json.dumps(durations, indent=1), encoding="utf-8")
    print(json.dumps(durations), "total", round(sum(durations.values()), 1))


if __name__ == "__main__":
    main()
