-- TerraWatch — Phase 10.0: AI/ML seed data.
--
-- Populates model_registry with all 7 ranked models from the DataSnake
-- AI/ML Roadmap doc, and model_inference_log with ~30 synthetic-but-
-- realistic inference results per Tier 1 model (pipeline, oil spill,
-- seismic InSAR). Allows the /ai-models UI to render immediately before
-- real model weights or sensor data are available.

-- =====================================================================
-- 1. Model registry — all 7 models
-- =====================================================================

insert into public.model_registry
  (slug, name, tier, score, status, architecture, dataset_name, dataset_url, accuracy_pct, description)
values
  (
    'pipeline-detection',
    'Underwater Pipeline & Infrastructure Defect Detection',
    1, 19, 'demo',
    'CNN + Transfer Learning (GoogleNet/ImageNet pre-trained)',
    'Marine-PULSE + SubPipe + NKSID',
    'https://arxiv.org/html/2412.11840v1',
    90.2,
    'Classifies side-scan sonar imagery of subsea pipelines and cables into intact, corroded, exposed, buried, or damaged. Directly proves the ROV + sonar + AI pipeline end-to-end for energy sector clients.'
  ),
  (
    'oil-spill',
    'Oil Spill & Marine Pollution Detection',
    1, 18, 'demo',
    'UNet semantic segmentation (MariNeXt architecture)',
    'MADOS + M4D SAR + Deep-SAR SOS (Gulf of Mexico)',
    'https://www.sciencedirect.com/science/article/pii/S0924271624000625',
    85.0,
    'Semantic segmentation model classifying satellite/SAR imagery into oil slick, look-alike, marine debris, and clean water. Powers the parametric insurance + environmental compliance narrative.'
  ),
  (
    'seismic-insar',
    'Seismic / Tectonic Deformation Detection (InSAR)',
    1, 17, 'demo',
    'VAE + AlexNet on Sentinel-1 InSAR interferograms',
    'Hephaestus InSAR + Global Coseismic InSAR Dataset',
    'https://arxiv.org/pdf/2204.09435',
    91.4,
    'Detects and classifies ground deformation patterns in InSAR satellite imagery: subsidence, uplift, volcanic unrest, and no-deformation. Makes the seismic precursor pitch credible with a trained model.'
  ),
  (
    'marine-biota',
    'Marine Ecosystem & Species Classification (ROV Video)',
    2, 16, 'planned',
    'YOLOv8 + Faster R-CNN object detection',
    'Deepdive (GBR) + BenthicNet + Brackish Dataset',
    'https://www.nature.com/articles/s41597-024-03766-3',
    84.0,
    'Object detection and classification of fish, coral, crustaceans, and deep-sea biota from ROV camera footage. Strong funding narrative; ties to Ocean Discovery League and deep-sea research partnerships.'
  ),
  (
    'water-quality',
    'Water Quality & Hyperspectral Pollution Detection',
    2, 14, 'planned',
    'Multispectral ML (Sentinel-2 + UAV hyperspectral fusion)',
    'UAV Hyperspectral + Google Earth Engine Sentinel time series',
    'https://www.mdpi.com/2076-3417/12/8/4016',
    85.0,
    'Detects water pollution beyond oil (algae blooms, agricultural runoff, industrial discharge) from multispectral satellite and UAV imagery. Broadens parametric insurance story beyond oil.'
  ),
  (
    'shipwreck-detection',
    'Shipwreck & Underwater Archaeological Object Detection',
    3, 11, 'planned',
    'Side-scan sonar object detection (CNN)',
    'AI4Shipwrecks (Thunder Bay National Marine Sanctuary)',
    'https://arxiv.org/html/2510.03353v1',
    null,
    'Sonar-based detection of shipwrecks and submerged objects. Strong demo value; niche direct revenue path (maritime insurance, salvage) unless expanded to general obstruction detection.'
  ),
  (
    'coral-reef',
    'Coral Reef Health & Bleaching Detection',
    3, 10, 'planned',
    'Dense video segmentation (CoralVOS architecture)',
    'CoralVOS + CoralScapes + Sweet Corals (90K images)',
    'https://arxiv.org/html/2509.01878v1',
    null,
    'Segmentation model tracking coral bleaching and reef health from ROV/diver imagery over time. Best positioned for grants and conservation partnerships; weak near-term revenue path.'
  )
on conflict (slug) do nothing;

-- =====================================================================
-- 2. Pipeline detection — 30 synthetic inference rows
-- =====================================================================

insert into public.model_inference_log
  (model_slug, input_source, detected_class, confidence, lat, lon, metadata, inferred_at)
values
  ('pipeline-detection','sonar:snp-sub-001','intact',     0.94, null, null, '{"segment_id":1,"pipeline_km":0.5,"bbox":[120,80,310,160],"depth_m":48}',  now() - interval '10 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','intact',     0.91, null, null, '{"segment_id":2,"pipeline_km":1.0,"bbox":[85,90,270,170],"depth_m":50}',   now() - interval '20 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','corroded',   0.87, null, null, '{"segment_id":3,"pipeline_km":1.5,"bbox":[200,60,390,180],"depth_m":52}',  now() - interval '30 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','corroded',   0.83, null, null, '{"segment_id":4,"pipeline_km":2.0,"bbox":[140,75,330,155],"depth_m":53}',  now() - interval '40 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','exposed',    0.79, null, null, '{"segment_id":5,"pipeline_km":2.5,"bbox":[95,110,280,190],"depth_m":54}',  now() - interval '50 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','intact',     0.92, null, null, '{"segment_id":6,"pipeline_km":3.0,"bbox":[160,70,350,165],"depth_m":55}',  now() - interval '60 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','buried',     0.74, null, null, '{"segment_id":7,"pipeline_km":3.5,"bbox":[110,95,290,175],"depth_m":56}',  now() - interval '70 minutes'),
  ('pipeline-detection','sonar:snp-sub-001','intact',     0.89, null, null, '{"segment_id":8,"pipeline_km":4.0,"bbox":[175,65,360,160],"depth_m":57}',  now() - interval '80 minutes'),
  ('pipeline-detection','sonar:bp-atl-003', 'corroded',   0.81, null, null, '{"segment_id":9,"pipeline_km":4.5,"bbox":[130,85,315,170],"depth_m":62}',  now() - interval '3 hours'),
  ('pipeline-detection','sonar:bp-atl-003', 'damaged',    0.76, null, null, '{"segment_id":10,"pipeline_km":5.0,"bbox":[90,100,275,185],"depth_m":63}', now() - interval '3 hours 10 minutes'),
  ('pipeline-detection','sonar:bp-atl-003', 'intact',     0.93, null, null, '{"segment_id":11,"pipeline_km":5.5,"bbox":[155,72,345,162],"depth_m":64}', now() - interval '3 hours 20 minutes'),
  ('pipeline-detection','sonar:bp-atl-003', 'exposed',    0.71, null, null, '{"segment_id":12,"pipeline_km":6.0,"bbox":[105,88,285,178],"depth_m":65}', now() - interval '3 hours 30 minutes'),
  ('pipeline-detection','sonar:bp-atl-003', 'corroded',   0.85, null, null, '{"segment_id":13,"pipeline_km":6.5,"bbox":[185,62,375,155],"depth_m":66}', now() - interval '3 hours 40 minutes'),
  ('pipeline-detection','sonar:bp-atl-003', 'intact',     0.90, null, null, '{"segment_id":14,"pipeline_km":7.0,"bbox":[125,78,310,168],"depth_m":67}', now() - interval '4 hours'),
  ('pipeline-detection','sonar:bp-atl-003', 'buried',     0.68, null, null, '{"segment_id":15,"pipeline_km":7.5,"bbox":[98,105,278,190],"depth_m":68}', now() - interval '4 hours 20 minutes'),
  ('pipeline-detection','sonar:snp-sub-002','intact',     0.95, null, null, '{"segment_id":16,"pipeline_km":8.0,"bbox":[165,68,352,158],"depth_m":71}', now() - interval '6 hours'),
  ('pipeline-detection','sonar:snp-sub-002','corroded',   0.78, null, null, '{"segment_id":17,"pipeline_km":8.5,"bbox":[112,92,295,172],"depth_m":72}', now() - interval '6 hours 30 minutes'),
  ('pipeline-detection','sonar:snp-sub-002','damaged',    0.72, null, null, '{"segment_id":18,"pipeline_km":9.0,"bbox":[195,58,385,150],"depth_m":73}', now() - interval '7 hours'),
  ('pipeline-detection','sonar:snp-sub-002','intact',     0.88, null, null, '{"segment_id":19,"pipeline_km":9.5,"bbox":[138,82,322,165],"depth_m":74}', now() - interval '7 hours 30 minutes'),
  ('pipeline-detection','sonar:snp-sub-002','exposed',    0.75, null, null, '{"segment_id":20,"pipeline_km":10.0,"bbox":[102,98,284,182],"depth_m":75}',now() - interval '8 hours'),
  ('pipeline-detection','sonar:snp-sub-002','intact',     0.91, null, null, '{"segment_id":21,"pipeline_km":10.5,"bbox":[170,65,358,155],"depth_m":76}',now() - interval '1 day'),
  ('pipeline-detection','sonar:snp-sub-002','corroded',   0.82, null, null, '{"segment_id":22,"pipeline_km":11.0,"bbox":[118,88,298,175],"depth_m":77}',now() - interval '1 day 1 hour'),
  ('pipeline-detection','sonar:snp-sub-002','buried',     0.69, null, null, '{"segment_id":23,"pipeline_km":11.5,"bbox":[88,108,268,192],"depth_m":78}',now() - interval '1 day 2 hours'),
  ('pipeline-detection','sonar:snp-sub-001','intact',     0.93, null, null, '{"segment_id":24,"pipeline_km":12.0,"bbox":[158,70,346,160],"depth_m":80}',now() - interval '2 days'),
  ('pipeline-detection','sonar:snp-sub-001','corroded',   0.80, null, null, '{"segment_id":25,"pipeline_km":12.5,"bbox":[122,84,306,168],"depth_m":81}',now() - interval '2 days 3 hours'),
  ('pipeline-detection','sonar:bp-atl-003', 'damaged',    0.73, null, null, '{"segment_id":26,"pipeline_km":13.0,"bbox":[93,102,272,188],"depth_m":82}',now() - interval '3 days'),
  ('pipeline-detection','sonar:bp-atl-003', 'intact',     0.96, null, null, '{"segment_id":27,"pipeline_km":13.5,"bbox":[180,60,368,152],"depth_m":83}',now() - interval '3 days 2 hours'),
  ('pipeline-detection','sonar:bp-atl-003', 'exposed',    0.77, null, null, '{"segment_id":28,"pipeline_km":14.0,"bbox":[115,90,295,175],"depth_m":84}',now() - interval '4 days'),
  ('pipeline-detection','sonar:snp-sub-002','corroded',   0.84, null, null, '{"segment_id":29,"pipeline_km":14.5,"bbox":[145,76,332,162],"depth_m":85}',now() - interval '5 days'),
  ('pipeline-detection','sonar:snp-sub-002','intact',     0.90, null, null, '{"segment_id":30,"pipeline_km":15.0,"bbox":[108,96,286,180],"depth_m":86}',now() - interval '6 days')
;

-- =====================================================================
-- 3. Oil spill — 30 synthetic inference rows (Gulf of Mexico region)
-- =====================================================================

insert into public.model_inference_log
  (model_slug, input_source, detected_class, confidence, lat, lon, location, metadata, inferred_at)
values
  ('oil-spill','satellite:sentinel-1-A','oil_slick',     0.97, 27.42,-91.18, st_makepoint(-91.18,27.42)::geography, '{"area_km2":4.2,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240712","polygon_geojson":"{\"type\":\"Polygon\",\"coordinates\":[[[-91.22,27.39],[-91.14,27.39],[-91.14,27.45],[-91.22,27.45],[-91.22,27.39]]]}"}', now() - interval '2 hours'),
  ('oil-spill','satellite:sentinel-1-A','oil_slick',     0.94, 27.55,-90.83, st_makepoint(-90.83,27.55)::geography, '{"area_km2":2.8,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240712"}',                                                                                                                                                        now() - interval '2 hours 10 minutes'),
  ('oil-spill','satellite:sentinel-1-A','look_alike',    0.71, 27.31,-91.42, st_makepoint(-91.42,27.31)::geography, '{"area_km2":1.1,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240712","note":"biogenic_film"}',                                                                                                                                   now() - interval '2 hours 15 minutes'),
  ('oil-spill','satellite:sentinel-1-A','marine_debris', 0.82, 27.68,-90.97, st_makepoint(-90.97,27.68)::geography, '{"area_km2":0.3,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240712"}',                                                                                                                                                          now() - interval '2 hours 20 minutes'),
  ('oil-spill','satellite:sentinel-1-A','clean_water',   0.95, 27.80,-91.55, st_makepoint(-91.55,27.80)::geography, '{"area_km2":null,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240712"}',                                                                                                                                                         now() - interval '2 hours 25 minutes'),
  ('oil-spill','satellite:sentinel-1-B','oil_slick',     0.91, 26.95,-91.07, st_makepoint(-91.07,26.95)::geography, '{"area_km2":3.5,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240711"}',                                                                                                                                                          now() - interval '5 hours'),
  ('oil-spill','satellite:sentinel-1-B','oil_slick',     0.88, 27.12,-90.78, st_makepoint(-90.78,27.12)::geography, '{"area_km2":1.9,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240711"}',                                                                                                                                                          now() - interval '5 hours 15 minutes'),
  ('oil-spill','satellite:sentinel-1-B','look_alike',    0.67, 27.35,-91.33, st_makepoint(-91.33,27.35)::geography, '{"area_km2":0.8,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240711","note":"wave_slick"}',                                                                                                                                      now() - interval '5 hours 30 minutes'),
  ('oil-spill','satellite:sentinel-1-B','marine_debris', 0.79, 27.52,-90.65, st_makepoint(-90.65,27.52)::geography, '{"area_km2":0.2,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240711"}',                                                                                                                                                          now() - interval '6 hours'),
  ('oil-spill','satellite:sentinel-2-A','oil_slick',     0.93, 27.28,-91.25, st_makepoint(-91.25,27.28)::geography, '{"area_km2":5.1,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240710"}',                                                                                                                                                      now() - interval '1 day'),
  ('oil-spill','satellite:sentinel-2-A','clean_water',   0.97, 28.10,-91.70, st_makepoint(-91.70,28.10)::geography, '{"area_km2":null,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240710"}',                                                                                                                                                     now() - interval '1 day 1 hour'),
  ('oil-spill','satellite:sentinel-2-A','oil_slick',     0.86, 26.88,-90.92, st_makepoint(-90.92,26.88)::geography, '{"area_km2":2.3,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240710"}',                                                                                                                                                      now() - interval '1 day 2 hours'),
  ('oil-spill','satellite:sentinel-2-A','look_alike',    0.74, 27.61,-91.48, st_makepoint(-91.48,27.61)::geography, '{"area_km2":0.6,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240710","note":"phytoplankton"}',                                                                                                                               now() - interval '1 day 3 hours'),
  ('oil-spill','satellite:sentinel-1-A','oil_slick',     0.89, 27.45,-90.88, st_makepoint(-90.88,27.45)::geography, '{"area_km2":3.0,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240709"}',                                                                                                                                                          now() - interval '2 days'),
  ('oil-spill','satellite:sentinel-1-A','marine_debris', 0.76, 27.72,-91.02, st_makepoint(-91.02,27.72)::geography, '{"area_km2":0.4,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240709"}',                                                                                                                                                          now() - interval '2 days 1 hour'),
  ('oil-spill','satellite:sentinel-1-B','oil_slick',     0.95, 27.18,-91.38, st_makepoint(-91.38,27.18)::geography, '{"area_km2":6.7,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240708"}',                                                                                                                                                          now() - interval '3 days'),
  ('oil-spill','satellite:sentinel-1-B','clean_water',   0.93, 28.25,-91.85, st_makepoint(-91.85,28.25)::geography, '{"area_km2":null,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240708"}',                                                                                                                                                         now() - interval '3 days 2 hours'),
  ('oil-spill','satellite:sentinel-2-A','oil_slick',     0.82, 26.78,-90.75, st_makepoint(-90.75,26.78)::geography, '{"area_km2":1.5,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240707"}',                                                                                                                                                      now() - interval '4 days'),
  ('oil-spill','satellite:sentinel-2-A','look_alike',    0.69, 27.88,-91.62, st_makepoint(-91.62,27.88)::geography, '{"area_km2":0.9,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240707","note":"rain_cell"}',                                                                                                                                   now() - interval '4 days 3 hours'),
  ('oil-spill','satellite:sentinel-1-A','oil_slick',     0.90, 27.38,-90.95, st_makepoint(-90.95,27.38)::geography, '{"area_km2":2.1,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240706"}',                                                                                                                                                          now() - interval '5 days'),
  ('oil-spill','satellite:sentinel-1-A','marine_debris', 0.73, 27.58,-91.15, st_makepoint(-91.15,27.58)::geography, '{"area_km2":0.2,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240706"}',                                                                                                                                                          now() - interval '5 days 1 hour'),
  ('oil-spill','satellite:sentinel-1-B','oil_slick',     0.87, 27.05,-91.28, st_makepoint(-91.28,27.05)::geography, '{"area_km2":3.8,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240705"}',                                                                                                                                                          now() - interval '6 days'),
  ('oil-spill','satellite:sentinel-1-B','clean_water',   0.96, 28.50,-92.10, st_makepoint(-92.10,28.50)::geography, '{"area_km2":null,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240705"}',                                                                                                                                                         now() - interval '6 days 2 hours'),
  ('oil-spill','satellite:sentinel-2-A','oil_slick',     0.92, 27.25,-91.05, st_makepoint(-91.05,27.25)::geography, '{"area_km2":4.5,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240704"}',                                                                                                                                                      now() - interval '7 days'),
  ('oil-spill','satellite:sentinel-2-A','look_alike',    0.65, 27.95,-91.75, st_makepoint(-91.75,27.95)::geography, '{"area_km2":0.7,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240704","note":"low_wind_sheen"}',                                                                                                                              now() - interval '7 days 1 hour'),
  ('oil-spill','satellite:sentinel-1-A','oil_slick',     0.85, 26.92,-90.88, st_makepoint(-90.88,26.92)::geography, '{"area_km2":2.6,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240703"}',                                                                                                                                                          now() - interval '8 days'),
  ('oil-spill','satellite:sentinel-1-A','marine_debris', 0.77, 27.48,-91.32, st_makepoint(-91.32,27.48)::geography, '{"area_km2":0.3,"satellite":"Sentinel-1A","scene_id":"S1A_IW_20240703"}',                                                                                                                                                          now() - interval '8 days 3 hours'),
  ('oil-spill','satellite:sentinel-1-B','oil_slick',     0.88, 27.15,-90.72, st_makepoint(-90.72,27.15)::geography, '{"area_km2":1.8,"satellite":"Sentinel-1B","scene_id":"S1B_IW_20240702"}',                                                                                                                                                          now() - interval '9 days'),
  ('oil-spill','satellite:sentinel-2-A','oil_slick',     0.91, 27.62,-91.08, st_makepoint(-91.08,27.62)::geography, '{"area_km2":3.2,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240701"}',                                                                                                                                                      now() - interval '10 days'),
  ('oil-spill','satellite:sentinel-2-A','clean_water',   0.94, 28.35,-91.95, st_makepoint(-91.95,28.35)::geography, '{"area_km2":null,"satellite":"Sentinel-2A","scene_id":"S2A_MSIL1C_20240701"}',                                                                                                                                                     now() - interval '10 days 2 hours')
;

-- =====================================================================
-- 4. Seismic InSAR — 30 synthetic rows (CA, Turkey, Japan regions)
-- =====================================================================

insert into public.model_inference_log
  (model_slug, input_source, detected_class, confidence, lat, lon, location, metadata, inferred_at)
values
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.93, 37.78,-122.42, st_makepoint(-122.42,37.78)::geography, '{"max_displacement_cm":-4.2,"coherence":0.81,"event_date":"2024-07-08","interferogram_id":"S1A_20240701_20240708_CA"}',    now() - interval '1 hour'),
  ('seismic-insar','satellite:sentinel-1-A','uplift',          0.87, 37.85,-122.28, st_makepoint(-122.28,37.85)::geography, '{"max_displacement_cm":2.1,"coherence":0.78,"event_date":"2024-07-08","interferogram_id":"S1A_20240701_20240708_CA"}',     now() - interval '1 hour 10 minutes'),
  ('seismic-insar','satellite:sentinel-1-A','no_deformation',  0.96, 37.62,-122.55, st_makepoint(-122.55,37.62)::geography, '{"max_displacement_cm":0.0,"coherence":0.92,"event_date":"2024-07-08","interferogram_id":"S1A_20240701_20240708_CA"}',     now() - interval '1 hour 20 minutes'),
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.89, 37.72,-122.38, st_makepoint(-122.38,37.72)::geography, '{"max_displacement_cm":-3.1,"coherence":0.79,"event_date":"2024-07-08","interferogram_id":"S1A_20240701_20240708_CA"}',    now() - interval '1 hour 30 minutes'),
  ('seismic-insar','satellite:ESA-S1-asc',  'subsidence',      0.91, 37.80,-122.45, st_makepoint(-122.45,37.80)::geography, '{"max_displacement_cm":-5.8,"coherence":0.83,"event_date":"2024-07-01","interferogram_id":"S1A_20240624_20240701_CA"}',    now() - interval '2 hours'),
  ('seismic-insar','satellite:ESA-S1-asc',  'uplift',          0.82, 37.91,-122.31, st_makepoint(-122.31,37.91)::geography, '{"max_displacement_cm":1.8,"coherence":0.76,"event_date":"2024-07-01","interferogram_id":"S1A_20240624_20240701_CA"}',     now() - interval '2 hours 30 minutes'),
  ('seismic-insar','satellite:sentinel-1-B','no_deformation',  0.95, 37.55,-122.62, st_makepoint(-122.62,37.55)::geography, '{"max_displacement_cm":0.2,"coherence":0.91,"event_date":"2024-06-24","interferogram_id":"S1B_20240617_20240624_CA"}',     now() - interval '3 hours'),
  ('seismic-insar','satellite:sentinel-1-B','subsidence',      0.84, 37.68,-122.48, st_makepoint(-122.48,37.68)::geography, '{"max_displacement_cm":-2.5,"coherence":0.77,"event_date":"2024-06-24","interferogram_id":"S1B_20240617_20240624_CA"}',    now() - interval '3 hours 30 minutes'),
  ('seismic-insar','satellite:sentinel-1-A','volcanic',        0.88, 38.02,-122.15, st_makepoint(-122.15,38.02)::geography, '{"max_displacement_cm":8.3,"coherence":0.71,"event_date":"2024-07-08","interferogram_id":"S1A_20240701_20240708_CA_V"}',   now() - interval '4 hours'),
  ('seismic-insar','satellite:sentinel-1-A','uplift',          0.79, 37.95,-122.22, st_makepoint(-122.22,37.95)::geography, '{"max_displacement_cm":3.4,"coherence":0.74,"event_date":"2024-07-08","interferogram_id":"S1A_20240701_20240708_CA"}',     now() - interval '4 hours 30 minutes'),
  -- Turkey (Kahramanmaras region, M7.8 Feb 2023 context)
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.96, 37.22, 36.88, st_makepoint(36.88,37.22)::geography,   '{"max_displacement_cm":-18.5,"coherence":0.85,"event_date":"2024-06-15","interferogram_id":"S1A_20240608_20240615_TR"}',    now() - interval '1 day'),
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.94, 37.15, 37.02, st_makepoint(37.02,37.15)::geography,   '{"max_displacement_cm":-12.2,"coherence":0.82,"event_date":"2024-06-15","interferogram_id":"S1A_20240608_20240615_TR"}',    now() - interval '1 day 1 hour'),
  ('seismic-insar','satellite:ESA-S1-asc',  'uplift',          0.91, 37.38, 36.72, st_makepoint(36.72,37.38)::geography,   '{"max_displacement_cm":7.6,"coherence":0.80,"event_date":"2024-06-15","interferogram_id":"S1A_20240608_20240615_TR"}',      now() - interval '1 day 2 hours'),
  ('seismic-insar','satellite:ESA-S1-asc',  'no_deformation',  0.97, 37.50, 36.55, st_makepoint(36.55,37.50)::geography,   '{"max_displacement_cm":0.1,"coherence":0.94,"event_date":"2024-06-15","interferogram_id":"S1A_20240608_20240615_TR"}',      now() - interval '1 day 3 hours'),
  ('seismic-insar','satellite:sentinel-1-B','subsidence',      0.90, 37.28, 36.95, st_makepoint(36.95,37.28)::geography,   '{"max_displacement_cm":-9.8,"coherence":0.79,"event_date":"2024-06-08","interferogram_id":"S1B_20240601_20240608_TR"}',     now() - interval '2 days'),
  ('seismic-insar','satellite:sentinel-1-B','uplift',          0.85, 37.42, 36.68, st_makepoint(36.68,37.42)::geography,   '{"max_displacement_cm":5.2,"coherence":0.76,"event_date":"2024-06-08","interferogram_id":"S1B_20240601_20240608_TR"}',      now() - interval '2 days 2 hours'),
  -- Japan (Noto Peninsula context)
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.92, 37.48,137.22, st_makepoint(137.22,37.48)::geography,  '{"max_displacement_cm":-22.4,"coherence":0.84,"event_date":"2024-05-28","interferogram_id":"S1A_20240521_20240528_JP"}',    now() - interval '3 days'),
  ('seismic-insar','satellite:sentinel-1-A','uplift',          0.88, 37.52,137.35, st_makepoint(137.35,37.52)::geography,  '{"max_displacement_cm":11.8,"coherence":0.81,"event_date":"2024-05-28","interferogram_id":"S1A_20240521_20240528_JP"}',     now() - interval '3 days 1 hour'),
  ('seismic-insar','satellite:sentinel-1-A','no_deformation',  0.95, 37.32,137.08, st_makepoint(137.08,37.32)::geography,  '{"max_displacement_cm":-0.3,"coherence":0.93,"event_date":"2024-05-28","interferogram_id":"S1A_20240521_20240528_JP"}',     now() - interval '3 days 2 hours'),
  ('seismic-insar','satellite:ESA-S1-asc',  'subsidence',      0.87, 37.58,137.28, st_makepoint(137.28,37.58)::geography,  '{"max_displacement_cm":-15.6,"coherence":0.78,"event_date":"2024-05-21","interferogram_id":"S1A_20240514_20240521_JP"}',    now() - interval '4 days'),
  ('seismic-insar','satellite:ESA-S1-asc',  'uplift',          0.83, 37.65,137.42, st_makepoint(137.42,37.65)::geography,  '{"max_displacement_cm":6.9,"coherence":0.75,"event_date":"2024-05-21","interferogram_id":"S1A_20240514_20240521_JP"}',      now() - interval '4 days 2 hours'),
  -- More CA rows
  ('seismic-insar','satellite:sentinel-1-B','subsidence',      0.86, 37.75,-122.40, st_makepoint(-122.40,37.75)::geography,'{"max_displacement_cm":-2.8,"coherence":0.77,"event_date":"2024-06-17","interferogram_id":"S1B_20240610_20240617_CA"}',     now() - interval '5 days'),
  ('seismic-insar','satellite:sentinel-1-B','no_deformation',  0.94, 37.58,-122.52, st_makepoint(-122.52,37.58)::geography,'{"max_displacement_cm":0.4,"coherence":0.90,"event_date":"2024-06-17","interferogram_id":"S1B_20240610_20240617_CA"}',      now() - interval '5 days 2 hours'),
  ('seismic-insar','satellite:sentinel-1-A','volcanic',        0.80, 38.08,-122.10, st_makepoint(-122.10,38.08)::geography,'{"max_displacement_cm":6.1,"coherence":0.68,"event_date":"2024-06-10","interferogram_id":"S1A_20240603_20240610_CA_V"}',    now() - interval '6 days'),
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.90, 37.70,-122.36, st_makepoint(-122.36,37.70)::geography,'{"max_displacement_cm":-3.6,"coherence":0.80,"event_date":"2024-06-10","interferogram_id":"S1A_20240603_20240610_CA"}',     now() - interval '6 days 2 hours'),
  ('seismic-insar','satellite:ESA-S1-asc',  'uplift',          0.85, 37.88,-122.25, st_makepoint(-122.25,37.88)::geography,'{"max_displacement_cm":2.7,"coherence":0.77,"event_date":"2024-06-10","interferogram_id":"S1A_20240603_20240610_CA"}',      now() - interval '7 days'),
  ('seismic-insar','satellite:sentinel-1-B','subsidence',      0.88, 37.22, 37.08, st_makepoint(37.08,37.22)::geography,  '{"max_displacement_cm":-8.4,"coherence":0.81,"event_date":"2024-05-14","interferogram_id":"S1B_20240507_20240514_TR"}',      now() - interval '8 days'),
  ('seismic-insar','satellite:sentinel-1-B','no_deformation',  0.96, 37.55,137.15, st_makepoint(137.15,37.55)::geography, '{"max_displacement_cm":0.2,"coherence":0.92,"event_date":"2024-05-07","interferogram_id":"S1B_20240430_20240507_JP"}',       now() - interval '9 days'),
  ('seismic-insar','satellite:sentinel-1-A','subsidence',      0.93, 37.40,137.30, st_makepoint(137.30,37.40)::geography, '{"max_displacement_cm":-19.2,"coherence":0.83,"event_date":"2024-04-30","interferogram_id":"S1A_20240423_20240430_JP"}',     now() - interval '10 days'),
  ('seismic-insar','satellite:ESA-S1-asc',  'volcanic',        0.78, 38.15,-122.05, st_makepoint(-122.05,38.15)::geography,'{"max_displacement_cm":4.8,"coherence":0.65,"event_date":"2024-04-23","interferogram_id":"S1A_20240416_20240423_CA_V"}',   now() - interval '11 days'),
  ('seismic-insar','satellite:sentinel-1-A','uplift',          0.84, 37.35, 36.80, st_makepoint(36.80,37.35)::geography,  '{"max_displacement_cm":4.1,"coherence":0.76,"event_date":"2024-04-16","interferogram_id":"S1A_20240409_20240416_TR"}',       now() - interval '12 days')
;
