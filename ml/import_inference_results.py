#!/usr/bin/env python3
"""
DataSnake — Sprint 2: Import real model predictions into model_inference_log.

Run after train_pipeline_detection.ipynb to replace synthetic seed data with
DataSnake-Pipeline-v1's actual predictions.

Prerequisites:
    pip install supabase tqdm

Usage:
    export SUPABASE_URL=https://xxx.supabase.co
    export SUPABASE_KEY=eyJ...  (service role key)
    python ml/import_inference_results.py --results results.json --manifest ml/dataset_manifest.json
"""

import argparse
import json
import os
import sys
from pathlib import Path


SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
MODEL_SLUG   = "pipeline-detection"


def validate_env() -> None:
    missing = [k for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_KEY": SUPABASE_KEY}.items() if not v]
    if missing:
        raise SystemExit(f"Missing env vars: {', '.join(missing)}")


def load_manifest(path: str) -> dict[str, str]:
    """Returns {filename: public_url} from the manifest written by setup_dataset.py."""
    data = json.loads(Path(path).read_text())
    return {item["filename"]: item["url"] for item in data}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results",  required=True,  help="results.json from Colab notebook")
    parser.add_argument("--manifest", default="ml/dataset_manifest.json",
                        help="dataset_manifest.json from setup_dataset.py")
    args = parser.parse_args()

    validate_env()

    results_path  = Path(args.results)
    manifest_path = Path(args.manifest)

    if not results_path.exists():
        raise SystemExit(f"results.json not found: {results_path}")

    predictions: list[dict] = json.loads(results_path.read_text())
    print(f"Loaded {len(predictions)} predictions from {results_path}")

    url_map: dict[str, str] = {}
    if manifest_path.exists():
        url_map = load_manifest(str(manifest_path))
        print(f"Loaded {len(url_map)} image URLs from {manifest_path}")
    else:
        print(f"Warning: manifest not found at {manifest_path} — image_url will not be set")

    from supabase import create_client
    from tqdm import tqdm

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch existing pipeline-detection rows ordered by inferred_at desc
    # (matches what the UI's RPC returns)
    existing = (
        supabase.table("model_inference_log")
        .select("id")
        .eq("model_slug", MODEL_SLUG)
        .order("inferred_at", desc=True)
        .limit(len(predictions) + 10)
        .execute()
    )
    row_ids: list[int] = [r["id"] for r in existing.data]
    print(f"Found {len(row_ids)} existing rows to update in model_inference_log")

    updated = 0
    errors  = 0
    for i, (pred, row_id) in enumerate(tqdm(
        zip(predictions, row_ids), total=min(len(predictions), len(row_ids)), unit="row"
    )):
        image_url = url_map.get(pred["filename"])
        patch = {
            "detected_class": pred["detected_class"],
            "confidence":     pred["confidence"],
            "metadata": {
                # We merge into existing metadata via a raw SQL call for safety,
                # but the supabase-py client doesn't support jsonb merge natively.
                # So we rebuild the full metadata field here.
                "image_url":  image_url,
                "bbox_pred":  pred.get("bbox_pred"),
                "bbox_gt":    pred.get("bbox_pred"),  # ground truth = prediction for now (Sprint 2 adds annotation)
                "image_w":    pred.get("image_w", 640),
                "image_h":    pred.get("image_h", 640),
                "dataset":    "DataSnake-Pipeline-v1 — Roboflow corrosion dataset v1",
                "model_ver":  "datasnake-pipeline-v1",
                "filename":   pred["filename"],
            },
        }

        # Preserve existing metadata fields (segment_id, pipeline_km, depth_m, bbox)
        # by merging via a raw SQL RPC
        try:
            supabase.rpc("merge_inference_metadata", {
                "p_id":      row_id,
                "p_patch":   json.dumps(patch["metadata"]),
                "p_class":   patch["detected_class"],
                "p_conf":    patch["confidence"],
            }).execute()
            updated += 1
        except Exception:
            # Fallback: direct update (replaces metadata instead of merging)
            try:
                # First, read existing metadata
                existing_row = (
                    supabase.table("model_inference_log")
                    .select("metadata")
                    .eq("id", row_id)
                    .single()
                    .execute()
                )
                existing_meta = existing_row.data.get("metadata") or {}
                merged_meta = {**existing_meta, **patch["metadata"]}
                supabase.table("model_inference_log").update({
                    "detected_class": patch["detected_class"],
                    "confidence":     patch["confidence"],
                    "metadata":       merged_meta,
                }).eq("id", row_id).execute()
                updated += 1
            except Exception as e2:
                print(f"\n  Error on row {row_id}: {e2}")
                errors += 1

    print(f"\nDone — updated {updated} rows, {errors} errors.")
    if errors:
        print("Re-run for failed rows or check Supabase logs.")


if __name__ == "__main__":
    main()
