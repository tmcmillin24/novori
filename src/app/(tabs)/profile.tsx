import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TabScreen } from '../../components/tab-screen';
import { COLORS } from '../../constants/novori-theme';

type ProfileTab = 'books' | 'reviews' | 'clubs';

type CurrentlyReadingBook = {
  id: string;
  title: string;
  coverUrl?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('books');

  // This is intentionally empty for now.
  // Once Supabase reading-status data is connected, populate this array
  // with all books whose status is "Reading".
  const currentlyReadingBooks: CurrentlyReadingBook[] = [];

  const previewBooks = currentlyReadingBooks.slice(0, 3);
  const remainingCount = Math.max(currentlyReadingBooks.length - 3, 0);

  function handleEditProfile() {
    Alert.alert(
      'Edit Profile',
      'Profile editing will be connected here next.'
    );
  }

  function openCurrentlyReading() {
    router.push('/currently-reading');
  }

  function renderTabContent() {
    if (activeTab === 'reviews') {
      return (
        <View style={styles.emptyActivity}>
          <Text style={styles.emptyActivityTitle}>
            Your reviews will show up here.
          </Text>

          <Text style={styles.emptyActivityText}>
            Ratings and reviews you publish on Novori will appear on your profile.
          </Text>
        </View>
      );
    }

    if (activeTab === 'clubs') {
      return (
        <View style={styles.emptyActivity}>
          <Text style={styles.emptyActivityTitle}>
            Your clubs will show up here.
          </Text>

          <Text style={styles.emptyActivityText}>
            Clubs you join or create will appear on your profile.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyActivity}>
        <Text style={styles.emptyActivityTitle}>
          Your reading life will show up here.
        </Text>

        <Text style={styles.emptyActivityText}>
          Finished books, favorites, and other reading activity will populate this profile as you use Novori.
        </Text>
      </View>
    );
  }

  return (
    <TabScreen scroll>
      <View style={styles.profileHeader}>
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

        <Text style={styles.bio}>
          Reader, reviewer, and professional TBR collector.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.stat,
            pressed && styles.pressed,
          ]}
          onPress={() => setActiveTab('books')}
        >
          <Text style={styles.statNumber}>
            0
          </Text>

          <Text style={styles.statLabel}>
            Books
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.stat,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            Alert.alert(
              'Followers',
              'Your followers list will open here.'
            )
          }
        >
          <Text style={styles.statNumber}>
            0
          </Text>

          <Text style={styles.statLabel}>
            Followers
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.stat,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            Alert.alert(
              'Following',
              'The readers you follow will open here.'
            )
          }
        >
          <Text style={styles.statNumber}>
            0
          </Text>

          <Text style={styles.statLabel}>
            Following
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleEditProfile}
        style={({ pressed }) => [
          styles.editButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="pencil-outline"
          size={16}
          color={COLORS.text}
        />

        <Text style={styles.editButtonText}>
          Edit Profile
        </Text>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Currently Reading
          </Text>

          <Pressable
            onPress={openCurrentlyReading}
            hitSlop={10}
            style={({ pressed }) => [
              styles.sectionActionRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sectionAction}>
              See all
            </Text>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.softGold}
            />
          </Pressable>
        </View>

        {previewBooks.length > 0 ? (
          <Pressable
            onPress={openCurrentlyReading}
            style={({ pressed }) => [
              styles.previewRow,
              pressed && styles.sectionPressed,
            ]}
          >
            {previewBooks.map((book) => (
              <View
                key={book.id}
                style={styles.previewBook}
              >
                {book.coverUrl ? (
                  <Image
                    source={{ uri: book.coverUrl }}
                    style={styles.previewCover}
                  />
                ) : (
                  <View style={styles.previewCoverPlaceholder}>
                    <Ionicons
                      name="book-outline"
                      size={24}
                      color={COLORS.gold}
                    />
                  </View>
                )}
              </View>
            ))}

            {remainingCount > 0 ? (
              <View style={styles.moreBadge}>
                <Text style={styles.moreBadgeText}>
                  +{remainingCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <Pressable
            onPress={openCurrentlyReading}
            style={({ pressed }) => [
              styles.emptyReading,
              pressed && styles.sectionPressed,
            ]}
          >
            <View style={styles.bookPlaceholder}>
              <Ionicons
                name="book-outline"
                size={26}
                color={COLORS.gold}
              />
            </View>

            <View style={styles.emptyReadingText}>
              <Text style={styles.emptyTitle}>
                Nothing here yet
              </Text>

              <Text style={styles.emptyText}>
                Books you mark as Reading will appear here.
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.profileTabs}>
        <Pressable
          onPress={() => setActiveTab('books')}
          style={({ pressed }) => [
            styles.profileTab,
            activeTab === 'books' && styles.profileTabActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="book-outline"
            size={18}
            color={
              activeTab === 'books'
                ? COLORS.gold
                : COLORS.mutedText
            }
          />

          <Text
            style={
              activeTab === 'books'
                ? styles.profileTabTextActive
                : styles.profileTabText
            }
          >
            Books
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('reviews')}
          style={({ pressed }) => [
            styles.profileTab,
            activeTab === 'reviews' && styles.profileTabActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="star-outline"
            size={18}
            color={
              activeTab === 'reviews'
                ? COLORS.gold
                : COLORS.mutedText
            }
          />

          <Text
            style={
              activeTab === 'reviews'
                ? styles.profileTabTextActive
                : styles.profileTabText
            }
          >
            Reviews
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('clubs')}
          style={({ pressed }) => [
            styles.profileTab,
            activeTab === 'clubs' && styles.profileTabActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={
              activeTab === 'clubs'
                ? COLORS.gold
                : COLORS.mutedText
            }
          />

          <Text
            style={
              activeTab === 'clubs'
                ? styles.profileTabTextActive
                : styles.profileTabText
            }
          >
            Clubs
          </Text>
        </Pressable>
      </View>

      {renderTabContent()}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.elevated,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.gold,
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
  },

  name: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginTop: 16,
  },

  username: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },

  bio: {
    color: COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 360,
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: 26,
    marginBottom: 18,
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statNumber: {
    color: COLORS.text,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },

  statLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },

  editButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  editButtonText: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },

  pressed: {
    opacity: 0.68,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 24,
  },

  section: {
    width: '100%',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },

  sectionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  sectionAction: {
    color: COLORS.softGold,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  sectionPressed: {
    opacity: 0.72,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 112,
  },

  previewBook: {
    width: 74,
  },

  previewCover: {
    width: 74,
    height: 108,
    borderRadius: 8,
    backgroundColor: COLORS.elevated,
  },

  previewCoverPlaceholder: {
    width: 74,
    height: 108,
    borderRadius: 8,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreBadgeText: {
    color: COLORS.softGold,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },

  emptyReading: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
  },

  bookPlaceholder: {
    width: 64,
    height: 88,
    borderRadius: 10,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyReadingText: {
    flex: 1,
    marginLeft: 14,
  },

  emptyTitle: {
    color: COLORS.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  emptyText: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  profileTabs: {
    flexDirection: 'row',
    gap: 8,
  },

  profileTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  profileTabActive: {
    backgroundColor: COLORS.surface,
  },

  profileTabText: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

  profileTabTextActive: {
    color: COLORS.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 46,
    paddingHorizontal: 24,
  },

  emptyActivityTitle: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },

  emptyActivityText: {
    color: COLORS.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
});
