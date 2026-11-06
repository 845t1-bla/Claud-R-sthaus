import { Button, Center, Code, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PasswordModal from './components/PasswordModal';
import { useAuth } from './lib/auth';
import { configured } from './lib/supabase';
import CheckoutPage from './pages/CheckoutPage';
import DashboardPage from './pages/DashboardPage';
import FlatPage from './pages/FlatPage';
import LoginPage from './pages/LoginPage';
import MembersPage from './pages/MembersPage';
import ProductsPage from './pages/ProductsPage';
import ReportsPage from './pages/ReportsPage';
import SalesPage from './pages/SalesPage';
import SettingsPage from './pages/SettingsPage';
import StockPage from './pages/StockPage';

export default function App() {
  const { session, staff, loading, signOut, passwordRecovery, clearRecovery } = useAuth();

  if (!configured) {
    return (
      <Center h="100vh" p="md">
        <Paper withBorder p="xl" maw={560}>
          <Title order={3} mb="sm">Einrichtung fehlt</Title>
          <Text>
            Bitte die Datei <Code>.env</Code> anlegen (Vorlage: <Code>.env.example</Code>) und die Supabase-URL sowie den
            Anon-Key eintragen. Details stehen in der <Code>README.md</Code>.
          </Text>
        </Paper>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!session) return <LoginPage />;

  if (!staff || !staff.active) {
    return (
      <Center h="100vh" p="md">
        <Paper withBorder p="xl" maw={480}>
          <Stack>
            <Title order={3}>Noch nicht freigeschaltet</Title>
            <Text>
              Du bist als <b>{session.user.email}</b> angemeldet, aber noch nicht als Ausgeber freigeschaltet. Bitte wende
              dich an die Rüsthaus-Verantwortlichen.
            </Text>
            <Button variant="light" onClick={() => void signOut()}>
              Abmelden
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <Layout>
      <PasswordModal opened={passwordRecovery} onClose={clearRecovery} title="Neues Passwort festlegen" />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/kasse" element={<CheckoutPage />} />
        <Route path="/kluftflat" element={<FlatPage />} />
        <Route path="/verkaeufe" element={<SalesPage />} />
        <Route path="/bestand" element={<StockPage />} />
        <Route path="/produkte" element={<ProductsPage />} />
        <Route path="/mitglieder" element={<MembersPage />} />
        <Route path="/berichte" element={<ReportsPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
