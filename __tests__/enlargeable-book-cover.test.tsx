import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable } from "react-native";
import EnlargeableBookCover from "../src/components/EnlargeableBookCover";
import { publishCatalogCovers } from "../src/lib/canonical-book-covers";
jest.mock("../src/components/BookCoverImage", () => ({
  __esModule: true,
  default: "BookCoverImage",
}));
jest.mock("../src/components/FullScreenImageViewer", () => ({
  __esModule: true,
  default: "FullScreenImageViewer",
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
test("opens the selected original artwork, follows confirmed updates and closes without navigation", async () => {
  publishCatalogCovers(
    { zoom_book: "https://art/selected-original.jpg" },
    { zoom_book: { locked: true } },
  );
  let view!: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(
      <EnlargeableBookCover
        googleBookId="zoom_book"
        existingCoverUrl="https://old/wrong.jpg"
        style={{ width: 155, height: 232 }}
      />,
    );
  });
  const modal = () => view.root.findByType("FullScreenImageViewer" as any);
  expect(modal().props.visible).toBe(false);
  await act(async () =>
    view.root
      .findAll(
        (node) =>
          node.props.accessibilityLabel === "Enlarge book cover" &&
          typeof node.props.onPress === "function",
      )[0]
      .props.onPress(),
  );
  expect(modal().props).toMatchObject({
    visible: true,
    uri: "https://art/selected-original.jpg",
    bookCover: true,
  });
  await act(async () =>
    publishCatalogCovers(
      { zoom_book: "https://art/new-manual.jpg" },
      { zoom_book: { locked: true } },
    ),
  );
  expect(modal().props.uri).toBe("https://art/new-manual.jpg");
  await act(async () => modal().props.onClose());
  expect(modal().props.visible).toBe(false);
  await act(async () => view.unmount());
});
test("an unavailable cover cannot open an empty viewer", async () => {
  publishCatalogCovers({ zoom_missing: null });
  let view!: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(
      <EnlargeableBookCover googleBookId="zoom_missing" />,
    );
  });
  expect(
    view.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Enlarge book cover" &&
        typeof node.props.onPress === "function",
    )[0].props.disabled,
  ).toBe(true);
  await act(async () => view.unmount());
});
