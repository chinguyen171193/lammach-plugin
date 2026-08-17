# REFERENCE_CHARACTER_V1

The approved source asset is installed here as:

`rp_claudia_rigged_002_yup_a.fbx`

This is the only model read by the new NPC runtime. Embedded animation clips
are inspected as the model loads; the runtime maps clips containing `idle`/`stand`
to `IDLE` and clips containing `walk` to `WALKING`.

Do not place a separate animation from another rig in this folder. The runtime does
not retarget or share skeletons.
