import { notifications } from '@mantine/notifications';

export function ok(message: string) {
  notifications.show({ color: 'green', title: 'Erledigt', message });
}

export function fail(err: unknown) {
  notifications.show({
    color: 'red',
    title: 'Fehler',
    message: err instanceof Error ? err.message : String(err),
    autoClose: 8000,
  });
}

/** Führt eine Aktion aus und zeigt Erfolg/Fehler an. Gibt true bei Erfolg zurück. */
export async function attempt(action: () => Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await action();
    if (success) ok(success);
    return true;
  } catch (e) {
    fail(e);
    return false;
  }
}
