#!/usr/bin/env python3
"""정본 프레임 PNG와 앱 스크린샷 PNG를 픽셀로 비교한다(2026-09-25 「픽셀 단위까지」).

    python3 scripts/canon/pixel-diff.py <정본.png> <앱.png> [--out 비교.png] [--threshold 24]

앱 그림을 정본 크기로 맞춘 뒤(같은 기기 폭 375로 찍었으면 비율만 맞춘다), 채널 차이가
threshold를 넘는 픽셀 비율을 적고, [정본 | 앱 | 차이] 세 칸 그림을 저장한다. 차이 칸은
다른 픽셀을 빨갛게 칠한다. 판정은 사람이 한다 — 문구·사진처럼 데이터가 다른 자리는
표에 따로 적고, 레이아웃·색·여백·크기 차이를 고친다.
"""
import argparse

from PIL import Image, ImageChops

parser = argparse.ArgumentParser()
parser.add_argument('canon')
parser.add_argument('app')
parser.add_argument('--out')
parser.add_argument('--threshold', type=int, default=24)
a = parser.parse_args()

canon = Image.open(a.canon).convert('RGB')
app = Image.open(a.app).convert('RGB')
if app.size != canon.size:
    app = app.resize(canon.size, Image.LANCZOS)

diff = ImageChops.difference(canon, app).convert('L')
mask = diff.point(lambda v: 255 if v > a.threshold else 0)
changed = sum(1 for v in mask.getdata() if v)
total = canon.size[0] * canon.size[1]
print(f'다른 픽셀 {changed}/{total} = {changed / total * 100:.2f}% (threshold {a.threshold})')

if a.out:
    w, h = canon.size
    red = Image.new('RGB', canon.size, (230, 40, 40))
    overlay = Image.composite(red, canon.point(lambda v: int(v * 0.35 + 165)), mask)
    sheet = Image.new('RGB', (w * 3 + 32, h), (255, 255, 255))
    sheet.paste(canon, (0, 0))
    sheet.paste(app, (w + 16, 0))
    sheet.paste(overlay, (w * 2 + 32, 0))
    sheet.save(a.out)
    print(a.out)
