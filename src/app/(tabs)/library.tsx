import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TabScreen } from '../../components/tab-screen';
import { COLORS } from '../../constants/novori-theme';

type LibrarySectionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

function LibrarySection({
  icon,
  title,
  subtitle,
}: LibrarySectionProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sectionCard,
        pressed && styles.sectionCardPressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={24}
          color={COLORS.gold}
        />
      </View>

      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        <Text style={styles.sectionSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.mutedText}
      />
    </Pressable>
  );
}

export default function LibraryScreen() {
  return (
    <TabScreen scroll>
      <View style={styles.header}>
        <Text style={styles.heading}>
          Library
        </Text>

        <Text style={styles.subheading}>
          Your books, shelves, and reading history.
        </Text>
      </View>

      <View style={styles.sections}>
        <LibrarySection
          icon="book-outline"
          title="Currently Reading"
          subtitle="Books you are reading now."
        />

        <LibrarySection
          icon="bookmark-outline"
          title="Want to Read"
          subtitle="Books waiting on your reading list."
        />

        <LibrarySection
          icon="checkmark-circle-outline"
          title="Read"
          subtitle="Books you have finished."
        />

        <LibrarySection
          icon="close-circle-outline"
          title="DNF"
          subtitle="Books you decided not to finish."
        />
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 26,
  },

  heading: {
    color: COLORS.gold,
    fontSize: 43,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  subheading: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },

  sections: {
    gap: 12,
  },

  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  sectionCardPressed: {
    opacity: 0.72,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  sectionText: {
    flex: 1,
    paddingRight: 10,
  },

  sectionTitle: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },

  sectionSubtitle: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
