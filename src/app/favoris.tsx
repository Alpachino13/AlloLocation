import { StyleSheet, Text, View } from 'react-native'

export default function Favoris() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes favoris</Text>
      <Text style={styles.empty}>Aucun favori sauvegardé.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 20 },
  empty: { color: '#999', fontSize: 15 },
})