import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  HelperText,
  Menu,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { createRequest } from '../api/requestsApi';
import { validateCreateRequest } from '../utils/validation';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export function CreateRequestScreen() {
  const navigation = useNavigation();
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [requiredCount, setRequiredCount] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit() {
    setError(null);
    const ve = validateCreateRequest({ jobTitle, description, priority, requiredCount });
    setFieldErrors(ve);
    if (Object.keys(ve).length) return;
    setLoading(true);
    try {
      await createRequest({
        jobTitle: jobTitle.trim(),
        department: department.trim() || undefined,
        description: description.trim(),
        priority,
        requiredCount: parseInt(requiredCount, 10),
        deadline: deadline.trim() ? new Date(deadline).toISOString() : null,
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="New recruitment request" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <TextInput
          label="Job title *"
          mode="outlined"
          value={jobTitle}
          onChangeText={setJobTitle}
          error={!!fieldErrors.jobTitle}
        />
        <HelperText type="error" visible={!!fieldErrors.jobTitle}>
          {fieldErrors.jobTitle}
        </HelperText>
        <TextInput
          label="Department (optional)"
          mode="outlined"
          value={department}
          onChangeText={setDepartment}
        />
        <TextInput
          label="Description *"
          mode="outlined"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          error={!!fieldErrors.description}
          style={{ marginTop: 8 }}
        />
        <HelperText type="error" visible={!!fieldErrors.description}>
          {fieldErrors.description}
        </HelperText>
        <Text variant="labelLarge" style={{ marginTop: 12 }}>
          Priority
        </Text>
        <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)} anchor={
          <Button mode="outlined" onPress={() => setMenuOpen(true)} style={{ marginTop: 8 }}>
            {priority.toUpperCase()}
          </Button>
        }>
          {PRIORITIES.map((p) => (
            <Menu.Item
              key={p}
              onPress={() => {
                setPriority(p);
                setMenuOpen(false);
              }}
              title={p}
            />
          ))}
        </Menu>
        <HelperText type="error" visible={!!fieldErrors.priority}>
          {fieldErrors.priority}
        </HelperText>
        <TextInput
          label="Required count *"
          mode="outlined"
          keyboardType="number-pad"
          value={requiredCount}
          onChangeText={setRequiredCount}
          error={!!fieldErrors.requiredCount}
          style={{ marginTop: 12 }}
        />
        <HelperText type="error" visible={!!fieldErrors.requiredCount}>
          {fieldErrors.requiredCount}
        </HelperText>
        <TextInput
          label="Deadline (ISO or leave empty)"
          mode="outlined"
          placeholder="2026-12-31"
          value={deadline}
          onChangeText={setDeadline}
          style={{ marginTop: 12 }}
        />
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading} style={{ marginTop: 24 }}>
          Submit request
        </Button>
      </ScrollView>
      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={5000}>
        {error}
      </Snackbar>
    </View>
  );
}
