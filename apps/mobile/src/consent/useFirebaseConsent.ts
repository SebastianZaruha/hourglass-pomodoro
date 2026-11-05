import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { useLanguage } from '../i18n/I18n';
import { applyChoice } from './collection';
import type { ConsentChoice, ConsentRecord } from './consent';
import { PRIVACY_APP_URL } from './privacy';
import { restoredConsent } from './restore';
import { writeStoredConsent } from './store';

export interface FirebaseConsent {
  /** Ya sabemos si hay una elección vigente (en iOS/web, al momento). */
  readonly ready: boolean;
  readonly record: ConsentRecord | null;
  /** Diálogo visible: primera vez, texto caducado, o «Cambiar» en Ajustes. */
  readonly prompt: boolean;
  readonly saving: boolean;
  readonly openPrompt: () => void;
  readonly dismissPrompt: () => void;
  readonly choose: (choice: ConsentChoice) => void;
  readonly openPrivacy: () => void;
}

/**
 * Consentimiento de Android. Fuera de Android no pregunta y no toca Firebase:
 * la web tiene su propio banner y no hay app de iOS en Firebase.
 */
export function useFirebaseConsent(): FirebaseConsent {
  const android = Platform.OS === 'android';
  const lang = useLanguage();
  const [ready, setReady] = useState(!android);
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [prompt, setPrompt] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!android) return;
    let live = true;
    restoredConsent.then((saved) => {
      if (!live) return;
      setRecord(saved);
      setReady(true);
      if (!saved) setPrompt(true);
    });
    return () => {
      live = false;
    };
  }, [android]);

  const choose = useCallback(
    (choice: ConsentChoice) => {
      if (!android || saving) return;
      setSaving(true);
      const reset = choice === 'rejected' && record?.choice === 'accepted';
      writeStoredConsent(choice)
        .then(async (next) => {
          await applyChoice(choice, reset);
          setRecord(next);
          setPrompt(false);
        })
        .catch(() => {
          // Sin guardar no cerramos: seguirían sin una prueba, o con la anterior.
        })
        .finally(() => setSaving(false));
    },
    [android, record, saving],
  );

  const openPrivacy = useCallback(() => {
    Linking.openURL(PRIVACY_APP_URL[lang]).catch(() => undefined);
  }, [lang]);

  const openPrompt = useCallback(() => setPrompt(true), []);
  const dismissPrompt = useCallback(() => {
    if (record) setPrompt(false);
  }, [record]);

  return {
    ready,
    record,
    prompt,
    saving,
    openPrompt,
    dismissPrompt,
    choose,
    openPrivacy,
  };
}
