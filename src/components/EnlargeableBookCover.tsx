import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Pressable } from "react-native";
import type { ComponentProps } from "react";
import BookCoverImage from "./BookCoverImage";
import FullScreenImageViewer from "./FullScreenImageViewer";
import {
  canonicalCoverKey,
  getCanonicalBookCover,
  subscribeCanonicalBookCovers,
} from "../lib/canonical-book-covers";
/** Enlarges the exact shared selection; never requests a different edition/artwork. */
export default function EnlargeableBookCover(
  props: ComponentProps<typeof BookCoverImage>,
) {
  const [open, setOpen] = useState(false);
  const key = canonicalCoverKey(props);
  useEffect(() => setOpen(false), [key]);
  const subscribe = useCallback(
    (listener: () => void) => subscribeCanonicalBookCovers(listener, key),
    [key],
  );
  const uri = useSyncExternalStore(
    subscribe,
    () => getCanonicalBookCover(props),
    () => null,
  );
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enlarge book cover"
        accessibilityHint="Opens the selected cover full screen"
        disabled={!uri}
        onPress={() => setOpen(true)}
      >
        <BookCoverImage {...props} />
      </Pressable>
      <FullScreenImageViewer
        visible={open}
        uri={uri}
        bookCover
        onClose={() => setOpen(false)}
      />
    </>
  );
}
