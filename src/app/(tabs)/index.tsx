import { StyleSheet, Text, View } from 'react-native';

import { TabScreen } from '../../components/tab-screen';
import { COLORS } from '../../constants/novori-theme';

export default function HomeScreen() {
  return (
    <TabScreen scroll>
      <View style={styles.brandBlock}>
        <Text style={styles.logo}>
          Novori
        </Text>

        <Text style={styles.slogan}>
          Read. Discuss. Belong.
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.card}>
        <Text style={styles.eyebrow}>
          YOUR FEED
        </Text>

        <Text style={styles.cardTitle}>
          Your reading world, all in one place.
        </Text>

        <Text style={styles.cardText}>
          Reviews, reactions, discussions, and reading activity from the
          people and books you care about will appear here.
        </Text>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    marginTop: 2,
  },

  logo: {
    color: COLORS.gold,
    fontSize: 43,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  slogan: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    marginTop: 5,
    letterSpacing: 0.15,
  },

  divider: {
    width: 42,
    height: 2,
    backgroundColor: COLORS.gold,
    marginTop: 24,
    marginBottom: 28,
    borderRadius: 1,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 21,
  },

  eyebrow: {
    color: COLORS.softGold,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    marginBottom: 11,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    lineHeight: 31,
  },

  cardText: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 23,
    marginTop: 12,
  },
});
