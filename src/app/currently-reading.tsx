import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/novori-theme';

export default function CurrentlyReadingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={COLORS.text}
              />
            </Pressable>

            <Text style={styles.title}>
              Currently Reading
            </Text>

            <View style={styles.topRowSpacer} />
          </View>

          <View style={styles.divider} />

          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="book-outline"
                size={34}
                color={COLORS.gold}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No books here yet
            </Text>

            <Text style={styles.emptyText}>
              Mark a book as Reading and it'll show up here.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  pressed: {
    opacity: 0.7,
  },

  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  topRowSpacer: {
    width: 44,
    height: 44,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 20,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 64,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    textAlign: 'center',
  },

  emptyText: {
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
  },
});
