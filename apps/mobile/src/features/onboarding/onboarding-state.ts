import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'weddingpick.onboardingCompleted.v1';

export async function isOnboardingCompleted(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, 'true');
}
