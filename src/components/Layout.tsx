import { AppShell, Burger, Group, Menu, NavLink, ScrollArea, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBuildingWarehouse,
  IconChevronDown,
  IconFileSpreadsheet,
  IconHome,
  IconKey,
  IconLogout,
  IconReceipt,
  IconSettings,
  IconShirt,
  IconShoppingCart,
  IconTag,
  IconUsers,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import PasswordModal from './PasswordModal';

const LINKS = [
  { to: '/', label: 'Übersicht', icon: IconHome },
  { to: '/kasse', label: 'Kasse', icon: IconShoppingCart },
  { to: '/kluftflat', label: 'Kluftflat', icon: IconShirt },
  { to: '/verkaeufe', label: 'Verkäufe', icon: IconReceipt },
  { to: '/bestand', label: 'Bestand', icon: IconBuildingWarehouse },
  { to: '/produkte', label: 'Produkte', icon: IconTag },
  { to: '/mitglieder', label: 'Mitglieder', icon: IconUsers },
  { to: '/berichte', label: 'Berichte & Inventur', icon: IconFileSpreadsheet },
  { to: '/einstellungen', label: 'Einstellungen', icon: IconSettings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { staff, signOut } = useAuth();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 230, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
            <Text fw={700} size="lg">
              Rüsthaus Roßtal
            </Text>
          </Group>
          <Menu position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" fw={500} truncate maw={140}>
                    {staff?.name}
                  </Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{staff?.role === 'admin' ? 'Admin' : 'Ausgeber'}</Menu.Label>
              <Menu.Item leftSection={<IconKey size={16} />} onClick={() => setPwOpen(true)}>
                Passwort ändern
              </Menu.Item>
              <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={() => void signOut()}>
                Abmelden
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Version {import.meta.env.VITE_APP_VERSION || 'lokal'}</Menu.Label>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" className="no-print">
        <ScrollArea>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              component={Link}
              to={l.to}
              label={l.label}
              leftSection={<l.icon size={18} />}
              active={l.to === '/' ? location.pathname === '/' : location.pathname.startsWith(l.to)}
              onClick={close}
              style={{ borderRadius: 8 }}
            />
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
      <PasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} title="Passwort ändern" />
    </AppShell>
  );
}
