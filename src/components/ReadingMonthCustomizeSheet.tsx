import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReadingMonthCharmArtwork from './ReadingMonthCharmArtwork';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { getDefaultReadingMonthCharmCategory, ReadingMonthCharm, ReadingMonthCharmCategory, READING_MONTH_CHARM_CATEGORIES, READING_MONTH_CHARM_OPTIONS } from '../lib/reading-month-charms';
import { ReadingMonthPersonalization } from '../lib/reading-month-personalization';
type Props = {
    visible: boolean;
    value: ReadingMonthPersonalization;
    monthLabel: string;
    monthIndex: number;
    onDismiss: () => void;
    onSave: (value: ReadingMonthPersonalization) => Promise<void> | void;
};
export default function ReadingMonthCustomizeSheet({ visible, value, monthLabel, monthIndex, onDismiss, onSave, }: Props) {
    const { colors, } = useNovoriTheme();
    const { width: windowWidth, } = useWindowDimensions();
    const styles = useMemo(() => createStyles(colors), [
        colors,
    ]);
    const insets = useSafeAreaInsets();
    const pageWidth = Math.min(windowWidth -
        36, 560);
    const [charms, setCharms,] = useState<ReadingMonthCharm[]>(value.charms);
    const [activeCategory, setActiveCategory,] = useState<ReadingMonthCharmCategory>(getDefaultReadingMonthCharmCategory(monthIndex));
    const [saving, setSaving,] = useState(false);
    const motion = useUiSheetMotion({ visible, busy: saving, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    const pagerRef = useRef<ScrollView | null>(null);
    useEffect(() => {
        if (visible) {
            setCharms(value.charms);
            const nextCategory = getDefaultReadingMonthCharmCategory(monthIndex);
            setActiveCategory(nextCategory);
            const index = READING_MONTH_CHARM_CATEGORIES.findIndex((category) => category.id ===
                nextCategory);
            requestAnimationFrame(() => {
                pagerRef.current?.scrollTo({
                    x: Math.max(0, index) *
                        pageWidth,
                    animated: false,
                });
            });
        }
    }, [
        monthIndex,
        pageWidth,
        value.charms,
        visible,
    ]);
    function toggleCharm(item: ReadingMonthCharm) {
        setCharms((current) => {
            if (current.includes(item)) {
                return current.filter((value) => value !==
                    item);
            }
            if (current.length >=
                8) {
                return current;
            }
            return [
                ...current,
                item,
            ];
        });
    }
    function clearAll() {
        if (saving ||
            charms.length ===
                0) {
            return;
        }
        setCharms([]);
    }
    function chooseCategory(category: ReadingMonthCharmCategory) {
        const index = READING_MONTH_CHARM_CATEGORIES.findIndex((item) => item.id ===
            category);
        setActiveCategory(category);
        pagerRef.current?.scrollTo({
            x: Math.max(0, index) *
                pageWidth,
            animated: true,
        });
    }
    async function save() {
        if (saving) {
            return;
        }
        try {
            setSaving(true);
            await onSave({ charms });
            motion.closeAfterAction();
        }
        finally {
            setSaving(false);
        }
    }
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={closeSmoothly} motion={motion}>
      <Pressable style={styles.backdrop} onPress={closeSmoothly}>
        <UiSheetBackdrop pointerEvents="none" style={[
            StyleSheet.absoluteFill,
            styles.backdropVisual,
            {}
        ]} motion={motion}/>

        <UiSheetSurface style={[
            styles.sheet,
            {
                paddingBottom: Math.max(20, insets.bottom +
                    10)
            }
        ]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>

            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="sparkles-outline" size={21} color={colors.gold}/>
              </View>

              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  Personalize {monthLabel}
                </Text>

                <Text style={styles.subtitle}>
                  Build your month with up to eight stickers.
                </Text>
              </View>
            </View>

            <View style={styles.selectedHeader}>
              <Text style={styles.sectionLabel}>
                YOUR CHARMS
              </Text>

              <View style={styles.selectedHeaderActions}>
                <Pressable disabled={charms.length ===
            0 ||
            saving} onPress={clearAll} hitSlop={6} style={({ pressed, }) => [
            styles.clearAllButton,
            (charms.length ===
                0 ||
                saving) &&
                styles.clearAllButtonDisabled,
            pressed &&
                charms.length >
                    0 &&
                !saving &&
                styles.pressed,
        ]}>
                  <Text style={styles.clearAllText}>
                    Clear All
                  </Text>
                </Pressable>

                <Text style={styles.counter}>
                  {charms.length}/8
                </Text>
              </View>
            </View>

            <View style={styles.selectedTray}>
              {charms.length >
            0 ? (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedTrayContent}>
                  {charms.map((charm) => (<Pressable key={charm} onPress={() => toggleCharm(charm)} style={({ pressed, }) => [
                    styles.selectedCharm,
                    pressed &&
                        styles.pressed,
                ]}>
                        <ReadingMonthCharmArtwork charm={charm} size={48}/>

                        <View style={styles.removeBadge}>
                          <Ionicons name="close" size={10} color={colors.background}/>
                        </View>
                      </Pressable>))}
                </ScrollView>) : (<View style={styles.emptySelected}>
                  <Ionicons name="add-circle-outline" size={17} color={colors.mutedText}/>

                  <Text style={styles.emptySelectedText}>
                    Pick stickers below to decorate this month.
                  </Text>
                </View>)}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
              {READING_MONTH_CHARM_CATEGORIES.map((category) => {
            const active = category.id ===
                activeCategory;
            return (<Pressable key={category.id} onPress={() => chooseCategory(category.id)} style={({ pressed, }) => [
                    styles.categoryTab,
                    active &&
                        styles.categoryTabActive,
                    pressed &&
                        styles.pressed,
                ]}>
                      <Text style={styles.categoryEmoji}>
                        {category.emoji}
                      </Text>

                      <Text style={[
                    styles.categoryLabel,
                    active &&
                        styles.categoryLabelActive
                ]}>
                        {category.label}
                      </Text>
                    </Pressable>);
        })}
            </ScrollView>

            <View style={[
            styles.pagerFrame,
            {
                width: pageWidth
            }
        ]}>
              <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" scrollEventThrottle={16} onMomentumScrollEnd={(event) => {
            const page = Math.round(event.nativeEvent.contentOffset.x /
                pageWidth);
            const category = READING_MONTH_CHARM_CATEGORIES[page];
            if (category) {
                setActiveCategory(category.id);
            }
        }}>
                {READING_MONTH_CHARM_CATEGORIES.map((category) => {
            const options = READING_MONTH_CHARM_OPTIONS.filter((option) => option.category ===
                category.id);
            return (<View key={category.id} style={[
                    styles.stickerPage,
                    {
                        width: pageWidth
                    }
                ]}>
                        {options.map((option) => {
                    const selected = charms.includes(option.id);
                    const disabled = !selected &&
                        charms.length >=
                            8;
                    return (<Pressable key={option.id} disabled={disabled} onPress={() => toggleCharm(option.id)} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{
                            selected,
                            disabled,
                        }} style={({ pressed, }) => [
                            styles.stickerChoice,
                            disabled &&
                                styles.stickerChoiceDisabled,
                            pressed &&
                                !disabled &&
                                styles.stickerChoicePressed,
                        ]}>
                                <View style={styles.stickerArtwork}>
                                  <ReadingMonthCharmArtwork charm={option.id} size={58}/>

                                  {selected ? (<View style={styles.selectedBadge}>
                                      <Ionicons name="checkmark" size={11} color={colors.background}/>
                                    </View>) : null}
                                </View>

                              </Pressable>);
                })}
                      </View>);
        })}
              </ScrollView>
            </View>

            <View style={styles.pagerDots}>
              {READING_MONTH_CHARM_CATEGORIES.map((category) => (<View key={category.id} style={[
                styles.pagerDot,
                category.id ===
                    activeCategory &&
                    styles.pagerDotActive
            ]}/>))}
            </View>

            <View style={styles.actions}>
              <Pressable disabled={saving} onPress={closeSmoothly} style={({ pressed, }) => [
            styles.cancelButton,
            pressed &&
                styles.pressed,
        ]}>
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable disabled={saving} onPress={() => void save()} style={({ pressed, }) => [
            styles.saveButton,
            (pressed ||
                saving) &&
                styles.pressed,
        ]}>
                <Text style={styles.saveText}>
                  {saving
            ? 'Saving...'
            : 'Save Charms'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </UiSheetSurface>
      </Pressable>
    </UiSheetModal>);
}
function createStyles(colors: NovoriColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdropVisual: {
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
        },
        sheet: {
            width: '100%',
            maxHeight: '91%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 18,
            paddingTop: 9,
        },
        handle: {
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 14,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            marginBottom: 16,
        },
        headerIcon: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerCopy: {
            flex: 1,
        },
        title: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        subtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            lineHeight: 16,
            marginTop: 2,
        },
        selectedHeader: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
        },
        sectionLabel: {
            color: colors.mutedText,
            fontFamily: 'Inter_700Bold',
            fontSize: 9,
            letterSpacing: 1,
        },
        selectedHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        clearAllButton: {
            paddingVertical: 4,
            paddingHorizontal: 2,
        },
        clearAllButtonDisabled: {
            opacity: 0.35,
        },
        clearAllText: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 9.5,
        },
        counter: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 10,
        },
        selectedTray: {
            height: 66,
            justifyContent: 'center',
            marginTop: 7,
            marginBottom: 10,
        },
        selectedTrayContent: {
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 2,
        },
        selectedCharm: {
            width: 56,
            height: 58,
            alignItems: 'center',
            justifyContent: 'center',
        },
        removeBadge: {
            position: 'absolute',
            right: 1,
            top: 1,
            width: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptySelected: {
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.border,
        },
        emptySelectedText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
        },
        categoryTabs: {
            alignItems: 'center',
            gap: 7,
            paddingRight: 8,
            paddingBottom: 8,
        },
        categoryTab: {
            minHeight: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            backgroundColor: colors.background,
        },
        categoryTabActive: {
            borderColor: colors.gold,
            backgroundColor: colors.elevated,
        },
        categoryEmoji: {
            fontSize: 15,
        },
        categoryLabel: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 9.5,
        },
        categoryLabelActive: {
            color: colors.gold,
        },
        pagerFrame: {
            alignSelf: 'center',
            overflow: 'hidden',
        },
        stickerPage: {
            minHeight: 166,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignContent: 'center',
            justifyContent: 'flex-start',
            paddingVertical: 5,
        },
        stickerChoice: {
            width: '25%',
            height: 80,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 2,
        },
        stickerChoiceDisabled: {
            opacity: 0.28,
        },
        stickerChoicePressed: {
            transform: [
                {
                    scale: 0.93,
                },
            ],
        },
        stickerArtwork: {
            width: 64,
            height: 64,
            alignItems: 'center',
            justifyContent: 'center',
        },
        selectedBadge: {
            position: 'absolute',
            right: -1,
            top: 1,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        pagerDots: {
            height: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: 1,
        },
        pagerDot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
        },
        pagerDotActive: {
            width: 12,
            backgroundColor: colors.gold,
        },
        actions: {
            flexDirection: 'row',
            gap: 9,
            marginTop: 9,
        },
        cancelButton: {
            flex: 1,
            minHeight: 45,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cancelText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11.5,
        },
        saveButton: {
            flex: 1.35,
            minHeight: 45,
            borderRadius: 13,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        saveText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 11.5,
        },
        pressed: {
            opacity: 0.76,
        },
    });
}
