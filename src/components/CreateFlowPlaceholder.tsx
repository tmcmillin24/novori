import { Ionicons } from '@expo/vector-icons';
import {
    useRouter,
} from 'expo-router';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';
import {
    useNovoriTheme,
} from '../context/theme-context';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  description: string;
  phaseLabel: string;
};

export default function CreateFlowPlaceholder({
  icon,
  eyebrow,
  title,
  description,
  phaseLabel,
}: Props) {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
      ]}
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={8}
          style={({
            pressed,
          }) => [
            styles.backButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={23}
            color={
              colors.text
            }
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Create
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <View
        style={
          styles.content
        }
      >
        <View
          style={
            styles.iconWrap
          }
        >
          <Ionicons
            name={
              icon
            }
            size={28}
            color={
              colors.gold
            }
          />
        </View>

        <Text
          style={
            styles.eyebrow
          }
        >
          {eyebrow}
        </Text>

        <Text
          style={
            styles.title
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.description
          }
        >
          {description}
        </Text>

        <View
          style={
            styles.phasePill
          }
        >
          <Text
            style={
              styles.phaseText
            }
          >
            {phaseLabel}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    header: {
      height:
        54,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        10,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },
    backButton: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
    },
    headerSpacer: {
      width:
        42,
      height:
        42,
    },
    content: {
      flex:
        1,
      width:
        '100%',
      maxWidth:
        620,
      alignSelf:
        'center',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        28,
      paddingBottom:
        80,
    },
    iconWrap: {
      width:
        62,
      height:
        62,
      borderRadius:
        20,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      marginBottom:
        18,
    },
    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10.5,
      letterSpacing:
        1.6,
      marginBottom:
        7,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        29,
      lineHeight:
        35,
      textAlign:
        'center',
    },
    description: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13.5,
      lineHeight:
        21,
      textAlign:
        'center',
      marginTop:
        10,
      maxWidth:
        470,
    },
    phasePill: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        999,
      paddingHorizontal:
        11,
      paddingVertical:
        6,
      marginTop:
        18,
    },
    phaseText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },
    pressed: {
      opacity:
        0.7,
    },
  });
}
