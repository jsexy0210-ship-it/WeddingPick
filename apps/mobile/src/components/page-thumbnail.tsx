import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { CapturedPage } from '@/features/capture/types';

/** 문서 한 장 미리보기. PDF는 미리보기를 만들지 않고 파일 표시만 한다. */
export function PageThumbnail({ page }: { page: Pick<CapturedPage, 'uri' | 'mimeType'> }) {
  if (page.mimeType.startsWith('image/')) {
    return <Image source={{ uri: page.uri }} style={styles.thumbnail} contentFit="cover" />;
  }

  return (
    <ThemedView type="backgroundSelected" style={[styles.thumbnail, styles.file]}>
      <ThemedText type="code">PDF</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 56,
    height: 72,
    borderRadius: Spacing.two,
  },
  file: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
