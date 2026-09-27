import { PropsWithChildren } from 'react';
import {
    ScrollView,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';

type TabScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function TabScreen({
  children,
  scroll = false,
  contentStyle,
}: TabScreenProps) {
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  if (scroll) {
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
          <View style={[styles.content, contentStyle]}>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <View style={styles.screen}>
        <View style={[styles.content, styles.flexContent, contentStyle]}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: NovoriColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
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

  flexContent: {
    flex: 1,
    paddingTop: 22,
    paddingBottom: 120,
  },
});
