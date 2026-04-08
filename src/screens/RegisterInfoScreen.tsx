import { View } from 'react-native';
import { Appbar, Button, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

/** Public self-registration is disabled; Super Admin provisions all accounts. */
export function RegisterInfoScreen() {
  const navigation = useNavigation();
  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Register" />
      </Appbar.Header>
      <View style={{ padding: 24 }}>
        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
          Account access
        </Text>
        <Text variant="bodyLarge" style={{ marginBottom: 16 }}>
          New users are created by a Super Admin. If you need an account, contact your organization
          administrator with your name, email, and intended role (Store Admin, HOD, or HR).
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Back to sign in
        </Button>
      </View>
    </View>
  );
}
