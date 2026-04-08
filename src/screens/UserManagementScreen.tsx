import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  List,
  Portal,
  Snackbar,
  Switch,
  Text,
  TextInput,
  FAB,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { createStore, listUsers, setUserActive } from '../api/usersApi';
import type { ManagedUser } from '../types/models';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function UserManagementScreen() {
  const navigation = useNavigation<Nav>();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeDialog, setStoreDialog] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function toggleActive(u: ManagedUser, value: boolean) {
    try {
      await setUserActive(u.UserId, value);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function addStore() {
    if (!storeName.trim()) return;
    try {
      await createStore(storeName.trim(), storeCode.trim() || undefined);
      setStoreDialog(false);
      setStoreName('');
      setStoreCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create store');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="User management" />
        <Appbar.Action icon="store-plus" onPress={() => setStoreDialog(true)} />
      </Appbar.Header>
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.UserId)}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderItem={({ item }) => (
          <List.Item
            title={item.FullName}
            description={`${item.Email} · ${item.RoleName}${item.StoreName ? ` · ${item.StoreName}` : ''}`}
            right={() => (
              <Switch value={item.IsActive} onValueChange={(v) => toggleActive(item, v)} />
            )}
          />
        )}
      />
      <FAB
        icon="account-plus"
        label="New user"
        style={{ position: 'absolute', right: 24, bottom: 24 }}
        onPress={() => navigation.navigate('CreateUser')}
      />
      <Portal>
        <Dialog visible={storeDialog} onDismiss={() => setStoreDialog(false)}>
          <Dialog.Title>New store</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" mode="outlined" value={storeName} onChangeText={setStoreName} />
            <TextInput
              label="Code (optional)"
              mode="outlined"
              value={storeCode}
              onChangeText={setStoreCode}
              style={{ marginTop: 8 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStoreDialog(false)}>Cancel</Button>
            <Button onPress={addStore}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={5000}>
        {error}
      </Snackbar>
    </View>
  );
}
