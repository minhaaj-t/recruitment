import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { login } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import { validateLogin } from '../utils/validation';

type LoginNav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<LoginNav>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit() {
    setError(null);
    const ve = validateLogin(email, password);
    setFieldErrors(ve);
    if (Object.keys(ve).length) return;
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      await setAuth(data.token, data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, justifyContent: 'center', padding: 24 }}
    >
      <Text variant="headlineMedium" style={{ marginBottom: 8 }}>
        Recruitment
      </Text>
      <Text variant="bodyMedium" style={{ marginBottom: 24, opacity: 0.7 }}>
        Sign in with your work account
      </Text>
      <TextInput
        label="Email"
        mode="outlined"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={!!fieldErrors.email}
      />
      <HelperText type="error" visible={!!fieldErrors.email}>
        {fieldErrors.email}
      </HelperText>
      <TextInput
        label="Password"
        mode="outlined"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={!!fieldErrors.password}
      />
      <HelperText type="error" visible={!!fieldErrors.password}>
        {fieldErrors.password}
      </HelperText>
      <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading} style={{ marginTop: 16 }}>
        Sign in
      </Button>
      <Button mode="text" onPress={() => navigation.navigate('Register')} style={{ marginTop: 8 }}>
        Need an account?
      </Button>
      <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={4000}>
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}
