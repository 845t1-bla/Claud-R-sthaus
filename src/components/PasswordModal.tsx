import { Button, Modal, PasswordInput, Stack } from '@mantine/core';
import { useState } from 'react';
import { attempt } from '../lib/notify';
import { supabase } from '../lib/supabase';

export default function PasswordModal({ opened, onClose, title }: { opened: boolean; onClose: () => void; title: string }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const error = pw.length > 0 && pw.length < 8 ? 'Mindestens 8 Zeichen' : pw2 && pw !== pw2 ? 'Passwörter stimmen nicht überein' : null;

  const save = async () => {
    setBusy(true);
    const okay = await attempt(async () => {
      const { error: e } = await supabase.auth.updateUser({ password: pw });
      if (e) throw new Error(e.message);
    }, 'Passwort gespeichert.');
    setBusy(false);
    if (okay) {
      setPw('');
      setPw2('');
      onClose();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title}>
      <Stack>
        <PasswordInput label="Neues Passwort" value={pw} onChange={(e) => setPw(e.currentTarget.value)} />
        <PasswordInput label="Wiederholen" value={pw2} onChange={(e) => setPw2(e.currentTarget.value)} error={error} />
        <Button onClick={save} loading={busy} disabled={!pw || pw !== pw2 || pw.length < 8}>
          Speichern
        </Button>
      </Stack>
    </Modal>
  );
}
