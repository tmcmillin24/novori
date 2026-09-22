import { StyleSheet, Text, View } from 'react-native';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Notifications
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Nothing new yet.
        </Text>

        <Text style={styles.cardText}>
          Likes, comments, follows, and reading activity will appear here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1A18',
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  title: {
    color: '#D4AF37',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 22,
  },

  card: {
    backgroundColor: '#26231F',
    borderWidth: 1,
    borderColor: '#3A352F',
    borderRadius: 18,
    padding: 20,
  },

  cardTitle: {
    color: '#F4F1EA',
    fontSize: 18,
    fontWeight: '700',
  },

  cardText: {
    color: '#B9B3A9',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
});