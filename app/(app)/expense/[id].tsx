import { useLocalSearchParams } from 'expo-router';

import { ExpenseEditorScreen } from '../../../components/ExpenseEditorScreen';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseEditorScreen expenseId={id} />;
}
