import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import SpoilerToggle from './SpoilerToggle';

type Action = { label: string; onPress: () => void; attached?: boolean };
export function PostAttachmentControls({ photo, book, spoilers, disabled = false }: {
  photo?: Action; book?: Action;
  spoilers?: { value: boolean; onChange: (value: boolean) => void };
  disabled?: boolean;
}) {
  const { colors } = useNovoriTheme();
  return <View style={styles.row}>
    {photo ? renderAction(photo, photo.attached ? 'image' : 'image-outline') : null}
    {book ? renderAction(book, book.attached ? 'book' : 'book-outline') : null}
    {spoilers ? <View style={styles.spoilers}>
      <SpoilerToggle {...spoilers} disabled={disabled}/>
    </View> : null}
  </View>;

  function renderAction(action: Action, icon: keyof typeof Ionicons.glyphMap) {
    return <Pressable accessibilityRole="button" accessibilityLabel={action.label}
      disabled={disabled} onPress={action.onPress} style={({pressed})=>[
        styles.action, {backgroundColor: action.attached ? colors.elevated : colors.surface, borderColor: colors.border},
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Ionicons name={icon} size={20} color={colors.gold}/>
    </Pressable>;
  }
}

export function RemovablePostAttachment({children, label, onRemove, disabled = false, style}: {
  children: ReactNode; label: string; onRemove: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useNovoriTheme();
  return <View style={[styles.attachment,style]}>
    {children}
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      onPress={event=>{event.stopPropagation();onRemove();}} hitSlop={7}
      style={({pressed})=>[styles.remove, {backgroundColor:colors.background,borderColor:colors.border}, (pressed || disabled) && styles.dimmed]}>
      <Ionicons name="close" color={colors.text} size={16}/>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  row: {flexDirection:'row',alignItems:'center',gap:8,marginTop:8},
  action: {width:40,height:40,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderRadius:12},
  spoilers: {flex:1,minWidth:0,marginLeft:4},
  attachment: {position:'relative'},
  remove: {position:'absolute',right:6,top:6,width:26,height:26,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,alignItems:'center',justifyContent:'center',zIndex:2,elevation:2},
  dimmed: {opacity:0.6},
});
