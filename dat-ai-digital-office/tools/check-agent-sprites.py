#!/usr/bin/env python3
"""Check WordPress AgentSprite sheet dimensions and frame alignment.

Requires Pillow only in the development environment:
    python -m pip install pillow

Run from the plugin directory:
    python tools/check-agent-sprites.py
    python tools/check-agent-sprites.py --strict
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
    parser = argparse.ArgumentParser(description='Validate AgentSprite dimensions and alpha alignment.')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1] / 'assets' / 'agents')
    parser.add_argument('--strict', action='store_true', help='Exit with an error when an alignment warning is found.')
    parser.add_argument('--json', action='store_true', help='Print a machine-readable report.')
    return parser.parse_args()


def frame_metrics(sheet: Image.Image, frame_width: int, frame_height: int, frames: int) -> list[dict[str, float]]:
    metrics: list[dict[str, float]] = []
    for index in range(frames):
        frame = sheet.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height))
        bbox = frame.getchannel('A').getbbox()
        if not bbox:
            metrics.append({'index': index, 'empty': True})
            continue
        left, top, right, bottom = bbox
        metrics.append({
            'index': index,
            'empty': False,
            'left': left,
            'top': top,
            'right': right,
            'bottom': bottom,
            'centerX': round((left + right) / 2, 2),
            'centerY': round((top + bottom) / 2, 2),
            'width': right - left,
            'height': bottom - top,
        })
    return metrics


def spread(values: list[float]) -> float:
    return round(max(values) - min(values), 2) if values else 0.0


def inspect_state(folder: Path, name: str, definition: dict, frame_width: int, frame_height: int) -> dict:
    path = folder / str(definition.get('image', ''))
    frames = int(definition.get('frames', 0))
    result: dict = {'state': name, 'file': str(path), 'valid': True, 'issues': []}
    if not path.is_file():
        result['valid'] = False
        result['issues'].append('missing file')
        return result

    with Image.open(path) as source:
        sheet = source.convert('RGBA')
    expected_size = (frame_width * frames, frame_height)
    result['size'] = sheet.size
    result['expectedSize'] = expected_size
    if sheet.size != expected_size:
        result['valid'] = False
        result['issues'].append(f'expected {expected_size[0]}x{expected_size[1]}, got {sheet.size[0]}x{sheet.size[1]}')
        return result

    metrics = frame_metrics(sheet, frame_width, frame_height, frames)
    result['frames'] = metrics
    occupied = [item for item in metrics if not item['empty']]
    if len(occupied) != frames:
        result['valid'] = False
        result['issues'].append('one or more frames have no visible alpha pixels')
        return result

    result['alignment'] = {
        'centerXSpread': spread([item['centerX'] for item in occupied]),
        'centerYSpread': spread([item['centerY'] for item in occupied]),
        'bottomSpread': spread([item['bottom'] for item in occupied]),
        'widthSpread': spread([item['width'] for item in occupied]),
        'heightSpread': spread([item['height'] for item in occupied]),
        'medianCenterX': round(median(item['centerX'] for item in occupied), 2),
        'medianBottom': round(median(item['bottom'] for item in occupied), 2),
    }
    return result


def inspect_agent(folder: Path) -> dict:
    config_path = folder / 'config.json'
    if not config_path.is_file():
        return {'agent': folder.name, 'valid': False, 'issues': ['missing config.json'], 'states': []}
    config = json.loads(config_path.read_text(encoding='utf-8'))
    frame_width = int(config.get('frameWidth', 320))
    frame_height = int(config.get('frameHeight', 400))
    states = [inspect_state(folder, state, definition, frame_width, frame_height) for state, definition in config.get('states', {}).items()]
    return {
        'agent': config.get('id', folder.name),
        'frameWidth': frame_width,
        'frameHeight': frame_height,
        'anchorX': config.get('anchorX'),
        'anchorY': config.get('anchorY'),
        'valid': all(state['valid'] for state in states),
        'states': states,
    }


def main() -> int:
    args = parse_args()
    reports = [inspect_agent(folder) for folder in sorted(args.root.iterdir()) if folder.is_dir() and not folder.name.startswith('_')]
    warnings = 0
    if args.json:
        print(json.dumps(reports, ensure_ascii=False, indent=2))
    else:
        for report in reports:
            print(f"\n{report['agent']} — {report['frameWidth']}x{report['frameHeight']}")
            for state in report['states']:
                if not state['valid']:
                    print(f"  {state['state']}: INVALID — {'; '.join(state['issues'])}")
                    continue
                alignment = state['alignment']
                message = (
                    f"  {state['state']}: center Δx {alignment['centerXSpread']:.1f}px, "
                    f"Δy {alignment['centerYSpread']:.1f}px, bottom Δ {alignment['bottomSpread']:.1f}px"
                )
                is_misaligned = alignment['centerXSpread'] > 8 or alignment['centerYSpread'] > 12 or alignment['bottomSpread'] > 6
                print(message + ('  WARNING: alignment drift' if is_misaligned else '  OK'))
                warnings += int(is_misaligned)

    invalid = any(not report['valid'] for report in reports)
    if invalid:
        return 2
    return 1 if args.strict and warnings else 0


if __name__ == '__main__':
    raise SystemExit(main())
