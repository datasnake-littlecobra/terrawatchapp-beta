-- TerraWatch — Phase 10.3 Sprint 1: Real pipeline images + bbox normalisation
--
-- Two things:
--   1. Normalises existing synthetic bbox values from absolute pixel coords (0–256)
--      to the [0,1] range the canvas drawing code expects.  Stores result in
--      metadata.bbox_norm so the original stays intact for reference.
--   2. Adds placeholder fields (image_url, dataset, image_w, image_h) to each
--      row so the UI can detect whether a real image is available yet.
--      Real URLs are written by ml/seed_pipeline_images.py after upload.

update public.model_inference_log
set metadata = metadata
  || jsonb_build_object(
       -- normalised bbox: divide absolute pixel coords by source tile size (256×256)
       'bbox_norm', jsonb_build_array(
         round(((metadata->'bbox'->0)::numeric / 256)::numeric, 4),
         round(((metadata->'bbox'->1)::numeric / 256)::numeric, 4),
         round(((metadata->'bbox'->2)::numeric / 256)::numeric, 4),
         round(((metadata->'bbox'->3)::numeric / 256)::numeric, 4)
       ),
       'image_w',   256,
       'image_h',   256,
       'dataset',   'synthetic-demo',
       -- null until ml/seed_pipeline_images.py uploads real images
       'image_url', null::text
     )
where model_slug = 'pipeline-detection'
  and metadata ? 'bbox';
