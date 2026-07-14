#!/usr/bin/env python3
"""
DataSnake — Sprint 1: Download pipeline defect dataset + upload to Supabase Storage.

What this script does:
  1. Downloads the Roboflow "Corrosion Detection in Subsea Pipelines" dataset
     as static YOLO-format files (images + annotations). No Roboflow API
     dependency after download — files are ours.
  2. Selects up to MAX_IMAGES representative images.
  3. Uploads them to the Supabase Storage bucket `pipeline-images`.
  4. Prints a SQL UPDATE snippet to run in the Supabase SQL editor to seed
     image_url and normalised bbox_norm into model_inference_log.

Prerequisites (run once):
    pip install roboflow supabase pillow tqdm

Environment variables (or edit the CONFIG block below):
    ROBOFLOW_API_KEY   — free account at roboflow.com → Settings → API key
    SUPABASE_URL       — e.g. https://xyzabc.supabase.co
    SUPABASE_KEY       — service role key (Settings → API → service_role)

Usage:
    export ROBOFLOW_API_KEY=rf_...
    export SUPABASE_URL=https://xxx.supabase.co
    export SUPABASE_KEY=eyJ...
    python ml/setup_dataset.py
"""

import os
import json
import glob
import pathlib
import textwrap
from typing import Optional

# ── CONFIG ────────────────────────────────────────────────────────────────────
ROBOFLOW_API_KEY: str = os.environ.get("ROBOFLOW_API_KEY", "")
SUPABASE_URL:     str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY:     str = os.environ.get("SUPABASE_KEY", "")

WORKSPACE_ID  = "corrosion-detection-zvmog"
PROJECT_ID    = "corrosion-detection-in-subsea-pipelines"
VERSION       = 1
DOWNLOAD_DIR  = pathlib.Path("ml/dataset")
BUCKET        = "pipeline-images"
STORAGE_PREFIX = "pipeline-detection"
MAX_IMAGES    = 30     # number of images to upload (representative sample)
# ─────────────────────────────────────────────────────────────────────────────


def validate_env() -> None:
    missing = [k for k, v in {
        "ROBOFLOW_API_KEY": ROBOFLOW_API_KEY,
        "SUPABASE_URL":     SUPABASE_URL,
        "SUPABASE_KEY":     SUPABASE_KEY,
    }.items() if not v]
    if missing:
        raise SystemExit(
            f"Missing required environment variables: {', '.join(missing)}\n"
            "See the script header for instructions."
        )


def download_dataset() -> pathlib.Path:
    from roboflow import Roboflow
    print(f"\n[1/3] Downloading dataset from Roboflow workspace '{WORKSPACE_ID}'...")
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace(WORKSPACE_ID).project(PROJECT_ID)
    version = project.version(VERSION)
    dataset = version.download("yolov8", location=str(DOWNLOAD_DIR))
    loc = pathlib.Path(dataset.location)
    print(f"      Dataset saved to: {loc}")
    return loc


def select_images(dataset_dir: pathlib.Path, max_n: int) -> list[pathlib.Path]:
    """Gather up to max_n images from train + valid splits."""
    images: list[pathlib.Path] = []
    for split in ("train", "valid", "test"):
        split_dir = dataset_dir / split / "images"
        if split_dir.exists():
            images.extend(sorted(split_dir.glob("*.jpg")))
            images.extend(sorted(split_dir.glob("*.jpeg")))
            images.extend(sorted(split_dir.glob("*.png")))
    # deterministic selection: take evenly spaced samples
    if len(images) > max_n:
        step = len(images) / max_n
        images = [images[int(i * step)] for i in range(max_n)]
    print(f"      Selected {len(images)} images (from {max_n} max).")
    return images


def read_annotation(image_path: pathlib.Path) -> Optional[list[float]]:
    """
    Read YOLO annotation file for an image.
    Returns [x1n, y1n, x2n, y2n] in normalised coords (0–1), or None.
    YOLO format: class cx cy w h  (all normalised 0–1).
    We convert centre+size → corner format.
    """
    label_path = image_path.parent.parent / "labels" / image_path.with_suffix(".txt").name
    if not label_path.exists():
        return None
    lines = label_path.read_text().strip().splitlines()
    if not lines:
        return None
    # Take the first annotation (largest bbox if multiple)
    best: Optional[list[float]] = None
    best_area = 0.0
    for line in lines:
        parts = line.split()
        if len(parts) < 5:
            continue
        cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        area = bw * bh
        if area > best_area:
            best_area = area
            x1 = max(0.0, cx - bw / 2)
            y1 = max(0.0, cy - bh / 2)
            x2 = min(1.0, cx + bw / 2)
            y2 = min(1.0, cy + bh / 2)
            best = [round(x1, 4), round(y1, 4), round(x2, 4), round(y2, 4)]
    return best


def upload_images(images: list[pathlib.Path]) -> list[dict]:
    """Upload images to Supabase Storage. Returns list of {path, url, bbox_norm}."""
    from supabase import create_client
    from tqdm import tqdm

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    results: list[dict] = []

    print(f"\n[2/3] Uploading {len(images)} images to Supabase Storage bucket '{BUCKET}'...")
    for img_path in tqdm(images, unit="img"):
        storage_path = f"{STORAGE_PREFIX}/{img_path.name}"
        content_type = "image/jpeg" if img_path.suffix.lower() in (".jpg", ".jpeg") else "image/png"

        with open(img_path, "rb") as f:
            data = f.read()

        try:
            supabase.storage.from_(BUCKET).upload(
                storage_path,
                data,
                file_options={"content-type": content_type, "upsert": "true"},
            )
        except Exception as e:
            print(f"      Warning: upload failed for {img_path.name}: {e}")
            continue

        public_url = (
            f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"
        )
        bbox_norm = read_annotation(img_path)
        results.append({
            "filename": img_path.name,
            "storage_path": storage_path,
            "url": public_url,
            "bbox_norm": bbox_norm,
        })

    print(f"      Uploaded {len(results)}/{len(images)} images successfully.")
    return results


def print_sql_seed(uploaded: list[dict]) -> None:
    """
    Print SQL to run in the Supabase SQL editor (or supabase/migrations/) to
    update model_inference_log with real image URLs and ground-truth bboxes.
    """
    print("\n[3/3] SQL to seed real image URLs into model_inference_log:")
    print("      Copy and run this in the Supabase SQL editor (Dashboard → SQL editor).\n")
    print("─" * 70)

    # Distribute images across the 30 existing pipeline-detection rows
    # by ordered inferred_at (newest first, matching the RPC default order).
    updates: list[str] = []
    for i, item in enumerate(uploaded):
        bbox_str = "null"
        if item["bbox_norm"]:
            b = item["bbox_norm"]
            bbox_str = f"'[{b[0]}, {b[1]}, {b[2]}, {b[3]}]'::jsonb"

        updates.append(textwrap.dedent(f"""
        update public.model_inference_log
        set metadata = metadata || jsonb_build_object(
          'image_url',  '{item["url"]}',
          'bbox_norm',  {bbox_str},
          'bbox_gt',    {bbox_str},
          'dataset',    'Roboflow — Corrosion Detection in Subsea Pipelines v1',
          'image_w',    640,
          'image_h',    640
        )
        where id = (
          select id from public.model_inference_log
          where model_slug = 'pipeline-detection'
          order by inferred_at desc
          limit 1 offset {i}
        );""").strip())

    print("\n".join(updates))
    print("\n" + "─" * 70)

    # Also save to a file for convenience
    out_path = pathlib.Path("ml/seed_image_urls.sql")
    out_path.write_text("-- Auto-generated by ml/setup_dataset.py — run in Supabase SQL editor\n\n" + "\n\n".join(updates) + "\n")
    print(f"\nSQL also saved to: {out_path}")

    # Save manifest
    manifest_path = pathlib.Path("ml/dataset_manifest.json")
    manifest_path.write_text(json.dumps(uploaded, indent=2))
    print(f"Image manifest saved to: {manifest_path}")


def main() -> None:
    validate_env()
    dataset_dir = download_dataset()
    images = select_images(dataset_dir, MAX_IMAGES)
    uploaded = upload_images(images)
    if uploaded:
        print_sql_seed(uploaded)
    else:
        print("No images uploaded — check errors above.")


if __name__ == "__main__":
    main()
