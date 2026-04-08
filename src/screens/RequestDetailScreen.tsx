import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Divider,
  Menu,
  Snackbar,
  Text,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import {
  adminUpdateRequest,
  getRequest,
  hodDecision,
  hrUpdate,
  manualReminder,
} from '../api/requestsApi';
import { StatusChip } from '../components/StatusChip';
import type { AppStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import type { RecruitmentRequestRow, TimelineEntry } from '../types/models';
import { workflowLabel } from '../utils/statusLabels';

type R = RouteProp<AppStackParamList, 'RequestDetail'>;

const HR_STATUSES = ['open', 'in_progress', 'on_hold', 'closed'] as const;

export function RequestDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<R>();
  const { id } = route.params;
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<RecruitmentRequestRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [comment, setComment] = useState('');
  const [hrNotes, setHrNotes] = useState('');
  const [modifiedReq, setModifiedReq] = useState('');
  const [hrStatus, setHrStatus] = useState<string>('open');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getRequest(id);
      setReq(data.request);
      setTimeline(data.timeline);
      setHrNotes(data.request.HrNotes || '');
      setModifiedReq(data.request.ModifiedRequirements || '');
      const wf = data.request.WorkflowStatus;
      const role = useAuthStore.getState().user?.roleCode;
      if (role === 'super_admin') {
        setHrStatus(wf);
      } else if (HR_STATUSES.includes(wf as (typeof HR_STATUSES)[number])) {
        setHrStatus(wf);
      } else {
        setHrStatus('open');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function onHod(decision: 'approve' | 'reject') {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await hodDecision(req.RequestId, decision, comment.trim() || undefined);
      setReq(updated);
      setComment('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function onHrSave() {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await hrUpdate(req.RequestId, {
        workflowStatus: hrStatus,
        hrNotes: hrNotes.trim() || undefined,
        modifiedRequirements: modifiedReq.trim() || undefined,
      });
      setReq(updated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAdminSave() {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminUpdateRequest(req.RequestId, {
        workflowStatus: hrStatus,
        hrNotes: hrNotes.trim() || undefined,
        modifiedRequirements: modifiedReq.trim() || undefined,
      });
      setReq(updated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRemind() {
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      await manualReminder(req.RequestId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reminder failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !req) {
    return (
      <View style={{ flex: 1 }}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Request" />
        </Appbar.Header>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  const showHod = user?.roleCode === 'hod' && req.WorkflowStatus === 'pending_hod';
  const showHr =
    user?.roleCode === 'hr' &&
    req.WorkflowStatus !== 'pending_hod' &&
    req.WorkflowStatus !== 'hod_rejected';
  const showAdmin = user?.roleCode === 'super_admin';
  const allStatuses = [
    'pending_hod',
    'hod_rejected',
    'hod_approved',
    ...HR_STATUSES,
  ] as const;

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={req.JobTitle} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <StatusChip status={req.WorkflowStatus} />
          <Text style={{ alignSelf: 'center' }}>Priority: {req.Priority}</Text>
        </View>
        <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
          {req.StoreName} · {req.StoreAdminName}
        </Text>
        {req.Department ? (
          <Text variant="bodySmall" style={{ marginBottom: 4 }}>
            Department: {req.Department}
          </Text>
        ) : null}
        <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
          {req.Description}
        </Text>
        <Text variant="bodySmall">Required: {req.RequiredCount}</Text>
        {req.Deadline ? (
          <Text variant="bodySmall">Deadline: {new Date(req.Deadline).toLocaleString()}</Text>
        ) : null}
        {req.HodComment ? (
          <Card style={{ marginTop: 12 }}>
            <Card.Title title="HOD comment" />
            <Card.Content>
              <Text>{req.HodComment}</Text>
            </Card.Content>
          </Card>
        ) : null}
        {req.HrNotes ? (
          <Card style={{ marginTop: 12 }}>
            <Card.Title title="HR notes" />
            <Card.Content>
              <Text>{req.HrNotes}</Text>
            </Card.Content>
          </Card>
        ) : null}
        {req.ModifiedRequirements ? (
          <Card style={{ marginTop: 12 }}>
            <Card.Title title="Modified requirements" />
            <Card.Content>
              <Text>{req.ModifiedRequirements}</Text>
            </Card.Content>
          </Card>
        ) : null}

        {showHod ? (
          <Card style={{ marginTop: 16 }}>
            <Card.Title title="HOD approval" />
            <Card.Content>
              <TextInput
                label="Comment"
                mode="outlined"
                multiline
                value={comment}
                onChangeText={setComment}
                style={{ marginBottom: 12 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button mode="contained" buttonColor="#2e7d32" onPress={() => onHod('approve')} loading={busy}>
                  Approve
                </Button>
                <Button mode="contained" buttonColor="#c62828" onPress={() => onHod('reject')} loading={busy}>
                  Reject
                </Button>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {showHr ? (
          <Card style={{ marginTop: 16 }}>
            <Card.Title title="HR processing" />
            <Card.Content>
              <Text variant="labelLarge">Status</Text>
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setMenuOpen(true)} style={{ marginTop: 8 }}>
                    {workflowLabel(hrStatus)}
                  </Button>
                }
              >
                {HR_STATUSES.map((s) => (
                  <Menu.Item
                    key={s}
                    title={workflowLabel(s)}
                    onPress={() => {
                      setHrStatus(s);
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </Menu>
              <TextInput
                label="HR notes"
                mode="outlined"
                multiline
                value={hrNotes}
                onChangeText={setHrNotes}
                style={{ marginTop: 12 }}
              />
              <TextInput
                label="Modified requirements"
                mode="outlined"
                multiline
                value={modifiedReq}
                onChangeText={setModifiedReq}
                style={{ marginTop: 12 }}
              />
              <Button mode="contained" onPress={onHrSave} loading={busy} style={{ marginTop: 16 }}>
                Save HR updates
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        {showAdmin ? (
          <Card style={{ marginTop: 16 }}>
            <Card.Title title="Super admin" />
            <Card.Content>
              <Text variant="labelLarge">Workflow status</Text>
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setMenuOpen(true)} style={{ marginTop: 8 }}>
                    {workflowLabel(hrStatus)}
                  </Button>
                }
              >
                {allStatuses.map((s) => (
                  <Menu.Item
                    key={s}
                    title={workflowLabel(s)}
                    onPress={() => {
                      setHrStatus(s);
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </Menu>
              <TextInput
                label="HR notes"
                mode="outlined"
                multiline
                value={hrNotes}
                onChangeText={setHrNotes}
                style={{ marginTop: 12 }}
              />
              <TextInput
                label="Modified requirements"
                mode="outlined"
                multiline
                value={modifiedReq}
                onChangeText={setModifiedReq}
                style={{ marginTop: 12 }}
              />
              <Button mode="contained" onPress={onAdminSave} loading={busy} style={{ marginTop: 16 }}>
                Save (admin)
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        {(user?.roleCode === 'store_admin' ||
          user?.roleCode === 'super_admin' ||
          user?.roleCode === 'hod' ||
          user?.roleCode === 'hr') && (
          <Button mode="outlined" onPress={onRemind} style={{ marginTop: 16 }} loading={busy}>
            Send manual reminder
          </Button>
        )}

        <Text variant="titleMedium" style={{ marginTop: 24, marginBottom: 8 }}>
          Timeline
        </Text>
        <Divider />
        {timeline.map((t) => (
          <Card key={t.TimelineId} style={{ marginTop: 8 }}>
            <Card.Content>
              <Text variant="titleSmall">{t.ActionType}</Text>
              <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                {t.UserName || 'System'} · {new Date(t.CreatedAt).toLocaleString()}
              </Text>
              {t.FromStatus || t.ToStatus ? (
                <Text variant="bodySmall" style={{ marginTop: 4 }}>
                  {t.FromStatus || '—'} → {t.ToStatus || '—'}
                </Text>
              ) : null}
              {t.Comment ? <Text style={{ marginTop: 8 }}>{t.Comment}</Text> : null}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={5000}>
        {error}
      </Snackbar>
    </View>
  );
}
