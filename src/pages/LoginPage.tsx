import { Anchor, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { attempt, ok } from '../lib/notify';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await attempt(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort falsch.' : error.message);
    });
    setBusy(false);
  };

  const reset = async () => {
    if (!email.trim()) return attempt(async () => { throw new Error('Bitte zuerst die E-Mail-Adresse eintragen.'); });
    await attempt(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL });
      if (error) throw new Error(error.message);
      ok('Wir haben dir eine E-Mail zum Zurücksetzen geschickt.');
    });
  };

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" w={380}>
        <form onSubmit={login}>
          <Stack>
            <Center>
              <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={56} height={56} />
            </Center>
            <Title order={2} ta="center">
              Rüsthaus Roßtal
            </Title>
            <Text c="dimmed" ta="center" size="sm">
              Anmeldung für Ausgabeberechtigte
            </Text>
            <TextInput label="E-Mail" type="email" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} autoComplete="username" />
            <PasswordInput label="Passwort" required value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="current-password" />
            <Button type="submit" loading={busy}>
              Anmelden
            </Button>
            <Anchor component="button" type="button" size="sm" onClick={() => void reset()}>
              Passwort vergessen?
            </Anchor>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
