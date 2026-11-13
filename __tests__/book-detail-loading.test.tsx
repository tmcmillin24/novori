import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text, StyleSheet } from "react-native";
import BookDetailLoading from "../src/components/BookDetailLoading";
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("../src/components/BookCoverImage", () => ({
  __esModule: true,
  default: "BookCoverImage",
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));
jest.mock("../src/context/theme-context", () => ({
  useNovoriTheme: () => ({
    colors: {
      background: "#eee",
      text: "#222",
      gold: "#a80",
      border: "#ddd",
      surface: "#fff",
      elevated: "#ddd",
      mutedText: "#777",
      secondaryText: "#888",
    },
  }),
}));
beforeAll(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
test("one detail-shaped placeholder keeps cover geometry stable as known metadata arrives and Back stays usable", async () => {
  const back = jest.fn();
  let view!: renderer.ReactTestRenderer;
  await act(async () => {
    view = renderer.create(
      <BookDetailLoading
        cover={{ googleBookId: "book" }}
        onBack={back}
        backLabel="Discover"
      />,
    );
  });
  const image = () => view.root.findByType("BookCoverImage" as any);
  const geometry = StyleSheet.flatten(image().props.style);
  await act(async () =>
    view.update(
      <BookDetailLoading
        title="Animal Farm"
        authors={["George Orwell"]}
        cover={{
          googleBookId: "book",
          existingCoverUrl: "https://art/original.jpg",
        }}
        onBack={back}
        backLabel="Discover"
      />,
    ),
  );
  expect(StyleSheet.flatten(image().props.style)).toEqual(geometry);
  expect(image().props.existingCoverUrl).toBe("https://art/original.jpg");
  expect(
    view.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .join(" "),
  ).toContain("Animal Farm");
  const button = view.root.findAll(
    (node) =>
      node.props.accessibilityLabel === "Back to Discover" &&
      typeof node.props.onPress === "function",
  )[0];
  await act(async () => button.props.onPress());
  expect(back).toHaveBeenCalledTimes(1);
  expect(
    view.root.findAll(
      (node) => node.props.accessibilityLabel === "Loading book details",
    ).length,
  ).toBeGreaterThan(0);
  await act(async () => view.unmount());
});
