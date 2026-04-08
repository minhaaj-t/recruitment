import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import {
  Appbar,
  FAB,
  List,
  Text,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { listRequests } from '../api/requestsApi';
import { RequestCard } from '../components/RequestCard';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useRecruitmentSocket } from '../hooks/useRecruitmentSocket';
import type { AppStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import type { RecruitmentRequestRow } from '../types/models';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [items, setItems] = useState<RecruitmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listRequests();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  useRecruitmentSocket(load);
  usePushRegistration();

  const pendingHod = useMemo(
    () => items.filter((r) => r.WorkflowStatus === 'pending_hod'),
    [items]
  );
  const pendingHr = useMemo(
    () => items.filter((r) => r.WorkflowStatus === 'hod_approved'),
    [items]
  );

  const title =
    user?.roleCode === 'super_admin'
      ? 'All requests'
      : user?.roleCode === 'hod'
        ? 'HOD inbox'
        : user?.roleCode === 'hr'
          ? 'HR tasks'
          : 'My requests';

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.Content title={title} subtitle={user?.fullName} />
        {user?.roleCode === 'super_admin' ? (
          <Appbar.Action
            icon="account-supervisor"
            onPress={() => navigation.navigate('UserManagement')}
          />
        ) : null}
        <Appbar.Action icon="logout" onPress={() => logout()} />
      </Appbar.Header>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => String(r.RequestId)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              {user?.roleCode === 'hod' && pendingHod.length > 0 ? (
                <>
                  <Text variant="titleSmall" style={{ marginBottom: 8 }}>
                    Pending your approval ({pendingHod.length})
                  </Text>
                  <Divider style={{ marginBottom: 12 }} />
                </>
              ) : null}
              {user?.roleCode === 'hr' && pendingHr.length > 0 ? (
                <>
                  <Text variant="titleSmall" style={{ marginBottom: 8 }}>
                    Waiting HR action ({pendingHr.length})
                  </Text>
                  <Divider style={{ marginBottom: 12 }} />
                </>
              ) : null}
              {items.length === 0 ? (
                <List.Item
                  title="No requests yet"
                  description="Create a request or check back later."
                />
              ) : null}
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
          renderItem={({ item }) => (
            <RequestCard
              item={item}
              onPress={() => navigation.navigate('RequestDetail', { id: item.RequestId })}
            />
          )}
        />
      )}
      {user?.roleCode === 'store_admin' ? (
        <FAB
          icon="plus"
          style={{ position: 'absolute', right: 24, bottom: 24 }}
          onPress={() => navigation.navigate('CreateRequest')}
        />
      ) : null}
    </View>
  );
}
