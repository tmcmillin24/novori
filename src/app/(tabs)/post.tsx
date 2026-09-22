import { StyleSheet, Text, View } from 'react-native';

export default function PostScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>
          CREATE
        </Text>

        <Text style={styles.title}>
          Share something with readers.
        </Text>

        <Text style={styles.subtitle}>
          Reviews, reading updates, questions, and discussions will live here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1A18',
    padding: 20,
    justifyContent: 'center',
  },

  card: {
    backgroundColor: '#26231F',
    borderWidth: 1,
    borderColor: '#3A352F',
    borderRadius: 18,
    padding: 24,
  },

  eyebrow: {
    color: '#C8A96B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  title: {
    color: '#F4F1EA',
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    color: '#B9B3A9',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
});