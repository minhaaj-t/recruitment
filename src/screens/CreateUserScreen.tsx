import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  Checkbox,
  Divider,
  Menu,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { createUser, listStores, listUsers } from '../api/usersApi';
import type { ManagedUser, StoreRow } from '../types/models';

const ROLES = [
  { code: 'store_admin', label: 'Store Admin' },
  { code: 'hod', label: 'HOD' },
  { code: 'hr', label: 'HR' },
  { code: 'super_admin', label: 'Super Admin' },
] as const;

export function CreateUserScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleCode, setRoleCode] = useState<string>('store_admin');
  const [roleMenu, setRoleMenu] = useState(false);
  const [storeMenu, setStoreMenu] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeAdmins, setStoreAdmins] = useState<ManagedUser[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [selectedAdmins, setSelectedAdmins] = useState<Record<number, boolean>>({});
  const [selectedStores, setSelectedStores] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [st, us] = await Promise.all([listStores(), listUsers()]);
      setStores(st);
      setStoreAdmins(us.filter((u) => u.RoleCode === 'store_admin'));
    } catch {
      /* handled on submit */
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const toggleAdmin = (id: number) => {
    setSelectedAdmins((p) => ({ ...p, [id]: !p[id] }));
  };
  const toggleStore = (id: number) => {
    setSelectedStores((p) => ({ ...p, [id]: !p[id] }));
  };

  async function submit() {
    setError(null);
    if (!email.trim() || !password || !fullName.trim()) {
      setError('Fill all required fields');
      return;
    }
    const body: Parameters<typeof createUser>[0] = {
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      roleCode,
    };
    if (roleCode === 'store_admin') {
      if (!storeId) {
        setError('Select a store for store admin');
        return;
      }
      body.storeId = storeId;
    }
    if (roleCode === 'hod') {
      const ids = Object.entries(selectedAdmins)
        .filter(([, v]) => v)
        .map(([k]) => parseInt(k, 10));
      if (!ids.length) {
        setError('Select at least one store admin for HOD');
        return;
      }
      body.hodStoreAdminIds = ids;
    }
    if (roleCode === 'hr') {
      const ids = Object.entries(selectedStores)
        .filter(([, v]) => v)
        .map(([k]) => parseInt(k, 10));
      if (!ids.length) {
        setError('Select at least one store for HR');
        return;
      }
      body.hrStoreIds = ids;
    }
    setLoading(true);
    try {
      await createUser(body);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  const storeLabel = stores.find((s) => s.StoreId === storeId)?.Name || 'Select store';

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Create user" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <TextInput label="Full name *" mode="outlined" value={fullName} onChangeText={setFullName} />
        <TextInput
          label="Email *"
          mode="outlined"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ marginTop: 12 }}
        />
        <TextInput
          label="Password *"
          mode="outlined"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ marginTop: 12 }}
        />
        <Text variant="labelLarge" style={{ marginTop: 16 }}>
          Role
        </Text>
        <Menu
          visible={roleMenu}
          onDismiss={() => setRoleMenu(false)}
          anchor={
            <Button mode="outlined" onPress={() => setRoleMenu(true)} style={{ marginTop: 8 }}>
              {ROLES.find((r) => r.code === roleCode)?.label || roleCode}
            </Button>
          }
        >
          {ROLES.map((r) => (
            <Menu.Item
              key={r.code}
              title={r.label}
              onPress={() => {
                setRoleCode(r.code);
                setRoleMenu(false);
              }}
            />
          ))}
        </Menu>

        {roleCode === 'store_admin' ? (
          <>
            <Text variant="labelLarge" style={{ marginTop: 16 }}>
              Store
            </Text>
            <Menu
              visible={storeMenu}
              onDismiss={() => setStoreMenu(false)}
              anchor={
                <Button mode="outlined" onPress={() => setStoreMenu(true)} style={{ marginTop: 8 }}>
                  {storeLabel}
                </Button>
              }
            >
              {stores.map((s) => (
                <Menu.Item
                  key={s.StoreId}
                  title={s.Name}
                  onPress={() => {
                    setStoreId(s.StoreId);
                    setStoreMenu(false);
                  }}
                />
              ))}
            </Menu>
          </>
        ) : null}

        {roleCode === 'hod' ? (
          <>
            <Text variant="labelLarge" style={{ marginTop: 16 }}>
              Assign to store admins
            </Text>
            {storeAdmins.map((a) => (
              <View key={a.UserId} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Checkbox
                  status={selectedAdmins[a.UserId] ? 'checked' : 'unchecked'}
                  onPress={() => toggleAdmin(a.UserId)}
                />
                <Text onPress={() => toggleAdmin(a.UserId)} style={{ flex: 1 }}>
                  {a.FullName} ({a.Email})
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {roleCode === 'hr' ? (
          <>
            <Text variant="labelLarge" style={{ marginTop: 16 }}>
              Assign stores
            </Text>
            {stores.map((s) => (
              <View key={s.StoreId} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Checkbox
                  status={selectedStores[s.StoreId] ? 'checked' : 'unchecked'}
                  onPress={() => toggleStore(s.StoreId)}
                />
                <Text onPress={() => toggleStore(s.StoreId)} style={{ flex: 1 }}>
                  {s.Name}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <Divider style={{ marginVertical: 24 }} />
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading}>
          Create user
        </Button>
      </ScrollView>
      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={6000}>
        {error}
      </Snackbar>
    </View>
  );
}
