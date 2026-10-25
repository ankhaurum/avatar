# Bust-master material production, 2026-10-26

Status: PARTIAL. Not a Cubism import candidate.

Photo 2 remains the face/hair authority. Its native Photoshop decode is the RGB comparison reference. Source coordinates and source RGB were retained.

## Verified defect and correction

The JSX path construction used the opposite handle direction to the observed Photoshop execution path. A four-point circle test rendered a diamond with four small loops. Swapping leftDirection/rightDirection rendered a smooth circle. This is direct evidence for this execution path, not a claim about every Photoshop version.

Corrected masks: face contour, two lips, four eyelids, two brows, nose, visible neck, neck foundation, two eye apertures, two assembly overlap masks and two source iris masks. Pre-correction PSD preserved as bust-before-bezier-fix-20261026.psd in this directory. Native face and neck inspections confirm removal of polygonal steps and loops.

Native transparent export versus the native Photoshop source reference, opaque pixels only:

| Part | Opaque pixels | Changed RGB pixels | Maximum channel difference |
| --- | ---: | ---: | ---: |
| Face contour | 74110 | 0 | 0 |
| Combined original lips | 3318 | 0 | 0 |
| Assembled eyes including hidden paint | 7604 | 387 | 43 |

The eye mismatch is located around iris boundaries, bbox x434..640/y411..448. Do not describe the assembled eyes as pixel-identical. Hidden iris/sclera paint and compositing transitions require further work. Face still contains original eyes/nose/mouth; feature removal is pending. The face export is not proof of finished independent skin.

Hair source was separated using the preserved head alpha and inverse skin eligibility. Eye contamination was excluded from its mask. Independent fringe/side/back divisions, hidden roots, ears and final occlusion remain pending.

Neck hair contamination was removed by narrowing the preserved source region and retaining a separate continuous painted foundation. Hidden paint is a review candidate.

## Inspection incident

An inspection script used activeLayer after duplication and targeted the wrong layer. The unsaved incident state was preserved as bust-inspection-incident-preserved-20261026.psd. The exact saved neck layer was restored from bust-saved-neck-recovery-20261026.psd. No history rollback was used. The extra source duplicate remains hidden. Original source and protected recovered documents were not closed or overwritten.

## HTTP 400 isolation

Codex CLI: 0.164.0-alpha.11.1. The stable enable_request_compression feature was true. A reversible isolation change set it to false using the official CLI. Original config retained beside config.toml as config.toml.before-http400-compression-test-20261026.bak. Parsed comparison confirmed every other setting unchanged.

This is not a confirmed root cause or confirmed fix. Current-thread transport still uses compression after the config change: log 8351636, timestamp 1792946753, pre_compression_bytes=1826374, post_compression_bytes=994704. The config modification timestamp is 1792945901. Thus the active session has not applied this flag, or a higher-priority runtime override is active. No application restart was performed. Do not repeat successful artwork operations after a chat transport failure.

No Cubism import, model export, publication, production change, Twinow/HUB/Drive modification, or replacement of the previous source artwork was performed.
