import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          N
        </Text>
      </View>

      <Text style={styles.name}>
        Novori Reader
      </Text>

      <Text style={styles.username}>
        @reader
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            0
          </Text>
          <Text style={styles.statLabel}>
            Books
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            0
          </Text>
          <Text style={styles.statLabel}>
            Followers
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statNumber}>
            0
          </Text>
          <Text style={styles.statLabel}>
            Following
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Currently Reading
        </Text>

        <Text style={styles.cardText}>
          Books you mark as Reading will show here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1A18',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 38,
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#302B25',
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#D4AF37',
    fontSize: 34,
    fontWeight: '800',
  },

  name: {
    color: '#F4F1EA',
    fontSize: 23,
    fontWeight: '700',
    marginTop: 16,
  },

  username: {
    color: '#9D968C',
    fontSize: 14,
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginVertical: 28,
  },

  stat: {
    alignItems: 'center',
  },

  statNumber: {
    color: '#F4F1EA',
    fontSize: 20,
    fontWeight: '700',
  },

  statLabel: {
    color: '#9D968C',
    fontSize: 12,
    marginTop: 4,
  },

  card: {
    width: '100%',
    backgroundColor: '#26231F',
    borderWidth: 1,
    borderColor: '#3A352F',
    borderRadius: 18,
    padding: 20,
  },

  cardTitle: {
    color: '#C8A96B',
    fontSize: 17,
    fontWeight: '700',
  },

  cardText: {
    color: '#B9B3A9',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
});