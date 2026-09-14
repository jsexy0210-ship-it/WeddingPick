#!/usr/bin/env node
/**
 * LEGACY: spec/tokens.json → 플랫폼별 토큰 파일 생성
 * 2026-09-10: 현재 스키마에서 undefined 출력이 확인돼 실사용·신규 프로젝트 복제를 보류한다.
 * 토큰 구조와 출력 검증을 보완한 뒤에만 재사용한다. 현행 npm/CI에서는 호출하지 않는다.
 *
 *   node gen-tokens.js ios      > WPTokens.swift
 *   node gen-tokens.js android  > WPTokens.kt
 *   node gen-tokens.js web      > tokens.css
 *
 * 손으로 옮기지 않는다. hex를 두 번 타이핑하면 반드시 갈라진다.
 */

const fs = require('fs');
const path = require('path');
const t = JSON.parse(fs.readFileSync(path.join(__dirname, 'spec', 'tokens.json'), 'utf8'));

const target = process.argv[2];
if (!['ios', 'android', 'web'].includes(target)) {
  console.error('usage: node gen-tokens.js ios|android|web');
  process.exit(2);
}

/* 색을 { 이름: hex } 로 평탄화 */
const colors = {};
for (const [group, entries] of Object.entries(t.color)) {
  if (group === 'skin') continue;
  for (const [name, v] of Object.entries(entries)) {
    if (name.startsWith('$')) continue;
    colors[group + cap(name)] = v.value;
    if (v.bg) colors[group + cap(name) + 'Bg'] = v.bg;
  }
}
const skins = t.color.skin.options;

function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function kebab(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
function snake(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(); }

/* ─────────────── iOS ─────────────── */
if (target === 'ios') {
  const L = [];
  L.push('// 생성 파일 — 직접 고치지 않는다. spec/tokens.json 을 고치고 다시 생성한다.');
  L.push('// node gen-tokens.js ios > WPTokens.swift');
  L.push('');
  L.push('import SwiftUI');
  L.push('');
  L.push('extension Color {');
  L.push('    init(hex: String) {');
  L.push('        let s = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex');
  L.push('        var v: UInt64 = 0');
  L.push('        Scanner(string: s).scanHexInt64(&v)');
  L.push('        self.init(.sRGB,');
  L.push('                  red:   Double((v >> 16) & 0xff) / 255,');
  L.push('                  green: Double((v >> 8) & 0xff) / 255,');
  L.push('                  blue:  Double(v & 0xff) / 255,');
  L.push('                  opacity: 1)');
  L.push('    }');
  L.push('}');
  L.push('');
  L.push('public enum WPColor {');
  for (const [k, v] of Object.entries(colors)) L.push(`    public static let ${k} = Color(hex: "${v}")`);
  L.push('}');
  L.push('');
  L.push('public enum WPSkin: String, CaseIterable {');
  skins.forEach((s) => L.push(`    case ${s.id}`));
  L.push('');
  L.push('    public var label: String {');
  L.push('        switch self {');
  skins.forEach((s) => L.push(`        case .${s.id}: return "${s.label}"`));
  L.push('        }');
  L.push('    }');
  L.push('');
  L.push('    public var color: Color {');
  L.push('        switch self {');
  skins.forEach((s) => L.push(`        case .${s.id}: return Color(hex: "${s.value}")`));
  L.push('        }');
  L.push('    }');
  L.push('');
  L.push('    /// Dark Gray 스킨에서도 Pick 버튼만 코랄을 유지한다.');
  L.push('    public var pickColor: Color {');
  L.push('        self == .darkgray ? Color(hex: "#FF6F61") : color');
  L.push('    }');
  L.push('');
  L.push(`    public static let `+`default`+`Skin: WPSkin = .coral`);
  L.push('}');
  L.push('');
  L.push('public enum WPFont {');
  t.typography.scale.forEach((r) => {
    const w = String(r.weight).includes('700') || r.weight === 700 ? '.bold' : '.regular';
    const lh = typeof r.lineHeight === 'number' ? r.lineHeight : parseInt(String(r.lineHeight).split('|')[0], 10);
    L.push(`    /// ${r.use}`);
    L.push(`    public static func ${r.role}(_ bold: Bool = ${String(r.weight) === '700' || r.weight === 700}) -> Font {`);
    L.push(`        .system(size: ${r.size}, weight: bold ? .bold : .regular)`);
    L.push('    }');
    L.push(`    public static let ${r.role}LineHeight: CGFloat = ${lh}`);
  });
  L.push('}');
  L.push('');
  L.push('public enum WPSpacing {');
  for (const [k, v] of Object.entries(t.spacing)) L.push(`    /// ${v.use}\n    public static let ${k}: CGFloat = ${v.value}`);
  L.push('}');
  L.push('');
  L.push('public enum WPSize {');
  for (const [k, v] of Object.entries(t.size)) {
    if (typeof v === 'number') L.push(`    public static let ${k}: CGFloat = ${v}`);
    else { L.push(`    public static let ${k}Min: CGFloat = ${v.min}`); L.push(`    public static let ${k}Max: CGFloat = ${v.max}`); }
  }
  L.push('}');
  L.push('');
  L.push('public enum WPRadius {');
  for (const [k, v] of Object.entries(t.radius)) if (!k.startsWith('$')) L.push(`    public static let ${k}: CGFloat = ${v}`);
  L.push('}');
  L.push('');
  L.push('public enum WPMotion {');
  L.push('    public static let pressScale: CGFloat = 0.97');
  L.push('    public static let pressDuration: Double = 0.10');
  L.push('    public static let sheetDuration: Double = 0.35');
  L.push('    public static let checkPopDuration: Double = 0.46');
  L.push('    public static let riseDuration: Double = 0.42');
  L.push('    public static let standard = Animation.timingCurve(0.16, 1, 0.3, 1)');
  L.push('    public static let spring = Animation.timingCurve(0.34, 1.56, 0.64, 1)');
  L.push('}');
  L.push('');
  L.push('public enum WPSymbol {');
  L.push('    /// Pick Mark — 절대 변경 금지');
  t.symbol.paths.forEach((p, i) => L.push(`    public static let path${i + 1} = "${p}"`));
  L.push(`    public static let strokeWidth: CGFloat = ${t.symbol.strokeWidth}`);
  L.push('    public static let viewBox: CGFloat = 24');
  L.push('}');
  console.log(L.join('\n'));
}

/* ─────────────── Android ─────────────── */
if (target === 'android') {
  const L = [];
  L.push('// 생성 파일 — 직접 고치지 않는다. spec/tokens.json 을 고치고 다시 생성한다.');
  L.push('// node gen-tokens.js android > WPTokens.kt');
  L.push('');
  L.push('package com.weddingpick.design');
  L.push('');
  L.push('import androidx.compose.ui.graphics.Color');
  L.push('import androidx.compose.ui.text.font.FontWeight');
  L.push('import androidx.compose.ui.unit.dp');
  L.push('import androidx.compose.ui.unit.sp');
  L.push('');
  L.push('object WPColor {');
  for (const [k, v] of Object.entries(colors)) L.push(`    val ${k} = Color(0xFF${v.replace('#', '')})`);
  L.push('}');
  L.push('');
  L.push('enum class WPSkin(val label: String, val color: Color) {');
  skins.forEach((s, i) => L.push(`    ${s.id.toUpperCase()}("${s.label}", Color(0xFF${s.value.replace('#', '')}))${i < skins.length - 1 ? ',' : ';'}`));
  L.push('');
  L.push('    /** Dark Gray 스킨에서도 Pick 버튼만 코랄을 유지한다. */');
  L.push('    val pickColor: Color get() = if (this == DARKGRAY) Color(0xFFFF6F61) else color');
  L.push('');
  L.push('    companion object { val Default = CORAL }');
  L.push('}');
  L.push('');
  L.push('object WPFont {');
  t.typography.scale.forEach((r) => {
    const lh = typeof r.lineHeight === 'number' ? r.lineHeight : parseInt(String(r.lineHeight).split('|')[0], 10);
    L.push(`    /** ${r.use} */`);
    L.push(`    val ${r.role}Size = ${r.size}.sp`);
    L.push(`    val ${r.role}LineHeight = ${lh}.sp`);
  });
  L.push('    val bold = FontWeight.Bold');
  L.push('    val regular = FontWeight.Normal');
  L.push('}');
  L.push('');
  L.push('object WPSpacing {');
  for (const [k, v] of Object.entries(t.spacing)) L.push(`    /** ${v.use} */\n    val ${k} = ${v.value}.dp`);
  L.push('}');
  L.push('');
  L.push('object WPSize {');
  for (const [k, v] of Object.entries(t.size)) {
    if (typeof v === 'number') L.push(`    val ${k} = ${v}.dp`);
    else { L.push(`    val ${k}Min = ${v.min}.dp`); L.push(`    val ${k}Max = ${v.max}.dp`); }
  }
  L.push('}');
  L.push('');
  L.push('object WPRadius {');
  for (const [k, v] of Object.entries(t.radius)) if (!k.startsWith('$')) L.push(`    val ${k} = ${v}.dp`);
  L.push('}');
  L.push('');
  L.push('object WPMotion {');
  L.push('    const val pressScale = 0.97f');
  L.push('    const val pressDurationMs = 100');
  L.push('    const val sheetDurationMs = 350');
  L.push('    const val checkPopDurationMs = 460');
  L.push('    const val riseDurationMs = 420');
  L.push('}');
  L.push('');
  L.push('object WPSymbol {');
  L.push('    /** Pick Mark — 절대 변경 금지 */');
  t.symbol.paths.forEach((p, i) => L.push(`    const val path${i + 1} = "${p}"`));
  L.push(`    const val strokeWidth = ${t.symbol.strokeWidth}f`);
  L.push('    const val viewBox = 24f');
  L.push('}');
  console.log(L.join('\n'));
}

/* ─────────────── Web ─────────────── */
if (target === 'web') {
  const L = [];
  L.push('/* 생성 파일 — 직접 고치지 않는다. spec/tokens.json 을 고치고 다시 생성한다. */');
  L.push('/* node gen-tokens.js web > tokens.css */');
  L.push('');
  L.push(':root {');
  for (const [k, v] of Object.entries(colors)) L.push(`  --wp-${kebab(k)}: ${v};`);
  L.push('');
  t.typography.scale.forEach((r) => {
    const lh = typeof r.lineHeight === 'number' ? r.lineHeight : parseInt(String(r.lineHeight).split('|')[0], 10);
    L.push(`  --wp-font-${r.role}: ${r.size}px;`);
    L.push(`  --wp-lh-${r.role}: ${lh}px;`);
  });
  L.push('');
  for (const [k, v] of Object.entries(t.spacing)) L.push(`  --wp-space-${kebab(k)}: ${v.value}px;`);
  L.push('');
  for (const [k, v] of Object.entries(t.size)) {
    if (typeof v === 'number') L.push(`  --wp-size-${kebab(k)}: ${v}px;`);
    else { L.push(`  --wp-size-${kebab(k)}-min: ${v.min}px;`); L.push(`  --wp-size-${kebab(k)}-max: ${v.max}px;`); }
  }
  L.push('');
  for (const [k, v] of Object.entries(t.radius)) if (!k.startsWith('$')) L.push(`  --wp-radius-${k}: ${v}px;`);
  L.push('');
  L.push(`  --wp-font-family: ${t.typography.$fontFamily.web};`);
  L.push('}');
  L.push('');
  skins.forEach((s) => {
    L.push(`[data-wp-skin="${s.id}"] {`);
    L.push(`  --wp-brand-primary: ${s.value};`);
    L.push(`  --wp-brand-pick: ${s.id === 'darkgray' ? '#FF6F61' : s.value};`);
    L.push('}');
  });
  console.log(L.join('\n'));
}
