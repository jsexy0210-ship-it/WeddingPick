import { build } from 'esbuild';

/**
 * 웹용 번들.
 *
 * 앱은 `src`를 그대로 쓴다(Metro가 react-native를 푼다). 이 빌드는 브라우저에서 도는
 * 도구 — claude.ai/design 같은 — 를 위한 것이라 `react-native`를 `react-native-web`으로
 * 바꿔 넣는다. **컴포넌트 소스는 하나다**: 여기서 다시 쓰지 않고 별칭만 건다.
 *
 * react/react-dom은 바깥에 둔다. 번들을 소비하는 쪽이 자기 React를 이미 들고 있고,
 * 두 벌이 되면 훅이 깨진다.
 */
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  alias: { 'react-native': 'react-native-web' },
  /*
   * `.web.*`를 먼저 찾는다. React Native 생태계가 플랫폼 분기를 파일 이름으로 하는
   * 방식이라, 이게 없으면 safe-area-context 같은 패키지가 네이티브 전용 파일로
   * 해석돼 번들이 깨진다. 이 패키지의 use-color-scheme.web.ts도 이 규칙으로 이긴다.
   */
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  // react-native-web은 __DEV__를 참조한다. 브라우저에는 없다.
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
