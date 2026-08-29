import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useSegments } from 'expo-router';

import { useTheme } from '@weddingpick/ui';

/**
 * Bottom Navigation: 홈 | 검색 | 촬영 | 내 웨딩 | MY
 * 사업계획서 31번 App IA. 배우자 연결(Phase 3) 후 "내 웨딩" 라벨은 "우리 웨딩"으로 바뀐다.
 */
export default function TabLayout() {
  const theme = useTheme();
  /*
   * 카메라는 전체 화면을 써야 문서를 화면에 맞추기 쉽다.
   *
   * 조각들을 문자열 배열로 받는다. 타입 생성기가 만드는 조각 유니온은 라우트를
   * 더할 때마다 좁아져서, 어느 날 `includes`가 아무 값도 못 받는 상태가 된다 —
   * 여기서 알고 싶은 것은 "카메라 화면인가" 하나뿐이라 그 유니온이 필요 없다.
   */
  const segments: readonly string[] = useSegments();
  const onCamera = segments.includes('camera');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tintInactive,
        tabBarStyle: onCamera
          ? { display: 'none' }
          : { backgroundColor: theme.background, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '검색',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: '제보',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="wedding"
        options={{
          title: '내 웨딩',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: 'MY',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
