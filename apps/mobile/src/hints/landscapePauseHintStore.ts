import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@reloj/landscape-pause-hint-seen';

export async function readLandscapePauseHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeLandscapePauseHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Cuota o modo privado: la pista puede volver en el siguiente arranque.
  }
}
