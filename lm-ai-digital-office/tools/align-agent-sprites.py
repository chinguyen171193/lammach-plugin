#!/usr/bin/env python3
"""Bake a common visual anchor into AgentSprite PNG frames.

This development utility keeps the sprite player simple: it corrects frame drift
inside PNG canvases instead of moving the card or swapping DOM elements.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median
import sys

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - only reached in a dev shell.
    raise SystemExit('Pillow is required. Install it with: python -m pip install pillow') from error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Bake a shared alpha anchor into AgentSprite sheets.')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1] / 'assets' / 'agents')
    parser.add_argument('--agent', action='append', dest='agents', help='Agent folder name; repeat to target several agents.')
    parser.add_argument('--scale', type=float, default=0.88, help='Uniform pre-alignment scale; default: 0.88.')
    parser.add_argument('--normalize-height', action='store_true', help='Normalize each frame alpha height to the median height of its state.')
    parser.add_argument('--normalize-width', action='store_true', help='Normalize each frame alpha width to the median width of its state.')
    parser.add_argument('--write', action='store_true', help='Write the corrected PNG files. Without this flag, only validate.')
    return parser.parse_args()


def alpha_height(frame: Image.Image) -> int:
    bbox = frame.getchannel('A').getbbox()
    if not bbox:
        raise ValueError('empty alpha frame')
    return bbox[3] - bbox[1]


def alpha_width(frame: Image.Image) -> int:
    bbox = frame.getchannel('A').getbbox()
    if not bbox:
        raise ValueError('empty alpha frame')
    return bbox[2] - bbox[0]


def aligned_frame(frame: Image.Image, frame_width: int, frame_height: int, anchor_x: int, anchor_y: int, scale_x: float, scale_y: float) -> Image.Image:
    scaled = frame.convert('RGBA').resize((round(frame_width * scale_x), round(frame_height * scale_y)), Image.Resampling.LANCZOS)
    padded = Image.new('RGBA', (frame_width, frame_height), (0, 0, 0, 0))
    origin_x = (frame_width - scaled.width) // 2
    origin_y = (frame_height - scaled.height) // 2
    source_bbox = scaled.getchannel('A').getbbox()
    if source_bbox and (source_bbox[0] + origin_x < 0 or source_bbox[2] + origin_x > frame_width or source_bbox[1] + origin_y < 0 or source_bbox[3] + origin_y > frame_height):
        raise ValueError('normalization would crop visible pixels; lower --scale or use a wider source canvas')
    padded.alpha_composite(scaled, (origin_x, origin_y))
    bbox = padded.getchannel('A').getbbox()
    if not bbox:
        raise ValueError('empty alpha frame')
    left, top, right, bottom = bbox
    move_x = round(anchor_x - ((left + right) / 2))
    move_y = round(anchor_y - bottom)
    if left + move_x < 0 or right + move_x > frame_width or top + move_y < 0 or bottom + move_y > frame_height:
        raise ValueError('alignment would crop visible pixels; lower --scale or change anchor')
    output = Image.new('RGBA', (frame_width, frame_height), (0, 0, 0, 0))
    output.alpha_composite(padded, (move_x, move_y))
    return output


def process_agent(folder: Path, args: argparse.Namespace) -> None:
    config = json.loads((folder / 'config.json').read_text(encoding='utf-8'))
    frame_width = int(config.get('frameWidth', 320))
    frame_height = int(config.get('frameHeight', 400))
    anchor_x = int(config.get('anchorX', frame_width // 2))
    anchor_y = int(config.get('anchorY', round(frame_height * 0.86)))
    for state, definition in config.get('states', {}).items():
        frames = int(definition['frames'])
        path = folder / definition['image']
        with Image.open(path) as source:
            sheet = source.convert('RGBA')
        if sheet.size != (frame_width * frames, frame_height):
            raise ValueError(f'{path}: unexpected sprite sheet dimensions')
        source_frames = [sheet.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height)) for index in range(frames)]
        target_height = median(alpha_height(frame) for frame in source_frames)
        target_width = median(alpha_width(frame) for frame in source_frames)
        output = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
        for index, frame in enumerate(source_frames):
            scale_x = args.scale
            scale_y = args.scale
            if args.normalize_height:
                scale_y *= target_height / alpha_height(frame)
            if args.normalize_width:
                scale_x *= target_width / alpha_width(frame)
            output.alpha_composite(aligned_frame(frame, frame_width, frame_height, anchor_x, anchor_y, scale_x, scale_y), (index * frame_width, 0))
        print(f'{folder.name}/{state}: anchor ({anchor_x}, {anchor_y}), scale {args.scale:.2f}')
        if args.write:
            temporary = path.with_suffix('.aligned.png')
            output.save(temporary, optimize=True)
            temporary.replace(path)


def main() -> int:
    args = parse_args()
    if not 0.5 <= args.scale <= 1:
        raise SystemExit('--scale must be between 0.5 and 1.')
    folders = [folder for folder in sorted(args.root.iterdir()) if folder.is_dir() and not folder.name.startswith('_')]
    if args.agents:
        wanted = set(args.agents)
        folders = [folder for folder in folders if folder.name in wanted]
    for folder in folders:
        process_agent(folder, args)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
