import { View, Text, StyleSheet } from 'react-native';

// TODO: API 미구현 — GET /v1/admin/reports (VOC · 신고 접수 큐 없음)

export default function ReportScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>VOC</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>신고 접수 큐 · 처리 이력</Text>
          <Text style={styles.placeholderDesc}>
            이 화면은 API가 구현되면 활성화돼요.
          </Text>
          <View style={styles.todoBox}>
            <Text style={styles.todoText}>TODO: API 미구현</Text>
            <Text style={styles.todoDetail}>
              {`GET /v1/admin/reports\nPOST /v1/admin/reports/:id/resolve`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#17181c' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  placeholder: {
    alignItems: 'center',
    maxWidth: 480,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3a3b40',
    marginBottom: 10,
  },
  placeholderDesc: {
    fontSize: 14,
    color: '#868b94',
    textAlign: 'center',
    marginBottom: 24,
  },
  todoBox: {
    backgroundColor: '#fff9e6',
    borderWidth: 1,
    borderColor: '#f5d86a',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  todoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92740a',
    marginBottom: 6,
  },
  todoDetail: {
    fontSize: 12,
    color: '#b89320',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
