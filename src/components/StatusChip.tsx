import { Chip } from 'react-native-paper';
import { workflowLabel } from '../utils/statusLabels';

type Props = {
  status: string;
  compact?: boolean;
};

export function StatusChip({ status, compact }: Props) {
  const label = workflowLabel(status);
  const mode = compact ? 'flat' : 'outlined';
  return <Chip mode={mode} compact={!!compact} style={{ alignSelf: 'flex-start' }}>{label}</Chip>;
}
