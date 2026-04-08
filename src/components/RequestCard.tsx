import { Pressable, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import type { RecruitmentRequestRow } from '../types/models';
import { StatusChip } from './StatusChip';
import { priorityColor } from '../utils/statusLabels';

type Props = {
  item: RecruitmentRequestRow;
  onPress: () => void;
};

export function RequestCard({ item, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ marginBottom: 10 }} mode="elevated">
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text variant="titleMedium" style={{ flex: 1 }} numberOfLines={2}>
              {item.JobTitle}
            </Text>
            <Text style={{ color: priorityColor(item.Priority), fontWeight: '700' }}>
              {item.Priority.toUpperCase()}
            </Text>
          </View>
          {item.StoreName ? (
            <Text variant="bodySmall" style={{ marginTop: 4, opacity: 0.7 }}>
              {item.StoreName}
            </Text>
          ) : null}
          <View style={{ marginTop: 8 }}>
            <StatusChip status={item.WorkflowStatus} compact />
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
}
