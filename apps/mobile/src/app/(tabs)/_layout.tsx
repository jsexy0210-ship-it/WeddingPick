import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useSegments } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/**
 * Bottom Navigation: 홈 | 검색 | 촬영 | 내 웨딩 | MY
 * 사업계획서 31번 App IA. 배우자 연결(Phase 3) 후 "내 웨딩" 라벨은 "우리 웨딩"으로 바뀐다.
 */
export default function TabLayout() {
  const theme = useTheme();
  // 카메라는 전체 화면을 써야 문서를 화면에 맞추기 쉽다.
  const onCamera = useSegments().includes('camera');

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
          title: '촬영',
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
