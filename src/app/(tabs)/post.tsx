import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants/novori-theme';

type CreateOptionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

function CreateOption({
  icon,
  title,
  subtitle,
  onPress,
}: CreateOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        pressed && styles.optionCardPressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={24}
          color={COLORS.gold}
        />
      </View>

      <View style={styles.optionTextContainer}>
        <Text style={styles.optionTitle}>
          {title}
        </Text>

        <Text style={styles.optionSubtitle}>
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

export default function PostScreen() {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              What would you like to share?
            </Text>

            <Text style={styles.subtitle}>
              Post updates, review books, or start something for the community.
            </Text>
          </View>

          <View style={styles.options}>
            <CreateOption
              icon="chatbubble-ellipses-outline"
              title="Create Post"
              subtitle="Share a thought, question, or discussion."
            />

            <CreateOption
              icon="star-outline"
              title="Review a Book"
              subtitle="Rate a book and share your review."
            />

            <CreateOption
              icon="book-outline"
              title="Reading Update"
              subtitle="Share what you are currently reading."
            />

            <CreateOption
              icon="people-outline"
              title="Create Club"
              subtitle="Start a reading community around shared interests."
            />

            <CreateOption
              icon="calendar-outline"
              title="Create Event"
              subtitle="Plan a virtual or in-person reading event."
            />
          </View>
        </View>
      </ScrollView>
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

  scrollContent: {
    flexGrow: 1,
    paddingTop: 22,
    paddingBottom: 120,
  },

  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  header: {
    marginBottom: 26,
  },

  title: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 36,
  },

  subtitle: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 560,
  },

  options: {
    gap: 12,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  optionCardPressed: {
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

  optionTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  optionTitle: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },

  optionSubtitle: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
