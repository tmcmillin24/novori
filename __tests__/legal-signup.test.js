import React from "react";
import renderer, { act } from "react-test-renderer";
import AuthScreen from "../src/app/auth";
import LegalAcceptanceGate from "../src/components/LegalAcceptanceGate";
import { supabase } from "../src/lib/supabase";
import {
  LEGAL_VERSION,
  acceptedCurrentTerms,
} from "../src/lib/legal-documents";
let mockPath = "/auth",
  mockAuthCallback;
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPath,
  useLocalSearchParams: () => ({}),
}));
jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (v) => v.ios ?? v.default },
  TurboModuleRegistry: { get: () => null },
  Keyboard: { addListener: () => ({ remove: jest.fn() }), dismiss: jest.fn() },
  ActivityIndicator: "ActivityIndicator",
  Modal: "Modal",
  Pressable: "Pressable",
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  StyleSheet: { create: (v) => v },
  Alert: { alert: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));
jest.mock(
  "../src/components/ValidationWarningSheet",
  () => "ValidationWarningSheet",
);
jest.mock("../src/context/theme-context", () => ({
  useNovoriTheme: () => ({
    colors: require("../src/constants/novori-theme").DARK_COLORS,
  }),
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      getSession: jest.fn(),
      updateUser: jest.fn(),
      onAuthStateChange: jest.fn((callback) => {
        mockAuthCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
  },
}));
jest.mock("../src/lib/sign-out", () => ({ signOutCurrentDevice: jest.fn() }));
jest.mock("../src/lib/account-deletion", () => ({
  getAccountDeletionStatus: jest.fn(),
}));
let view, silence;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockPath = "/auth";
  silence = jest.spyOn(console, "error").mockImplementation(() => {});
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.signUp.mockResolvedValue({
    data: { session: null },
    error: null,
  });
  supabase.from.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
    }),
  });
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  view = null;
  silence.mockRestore();
});
async function mount(component) {
  await act(async () => {
    view = renderer.create(component);
  });
}
async function pressLabel(label) {
  await act(async () =>
    view.root
      .findAllByType("Pressable")
      .find((p) => p.props.accessibilityLabel === label)
      .props.onPress(),
  );
}
async function signup() {
  await mount(<AuthScreen />);
  await act(async () =>
    view.root
      .findAllByType("Pressable")
      .find((p) =>
        p.findAllByType("Text").some((t) => t.props.children === "Create one"),
      )
      .props.onPress(),
  );
  for (const [placeholder, value] of [
    ["Display name", "Reader"],
    ["username", "reader"],
    ["Email", "reader@example.com"],
    ["Password", "password123"],
    ["Confirm password", "password123"],
  ])
    await act(async () =>
      view.root
        .findAllByType("TextInput")
        .find((i) => i.props.placeholder === placeholder)
        .props.onChangeText(value),
    );
}
async function submit() {
  await act(async () =>
    view.root
      .findAllByType("Pressable")
      .find((p) =>
        p
          .findAllByType("Text")
          .some((t) => t.props.children === "Create Account"),
      )
      .props.onPress(),
  );
}
test("signup requires adulthood and explicit terms acceptance before any account lookup or creation", async () => {
  await signup();
  await submit();
  expect(supabase.from).not.toHaveBeenCalled();
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
  await pressLabel("I confirm I am 18 or older");
  await submit();
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
  expect(
    view.root.findByType("ValidationWarningSheet").props.message,
  ).toContain("agree");
});
test("accepted signup records policy versions and an age attestation without collecting a birth date", async () => {
  await signup();
  await pressLabel("I confirm I am 18 or older");
  await pressLabel(
    "I agree to the Terms of Service and acknowledge the Privacy Policy",
  );
  await submit();
  const call = supabase.auth.signUp.mock.calls[0][0];
  expect(call.options.data).toMatchObject({
    terms_version: LEGAL_VERSION,
    privacy_version: LEGAL_VERSION,
    adult_confirmed: true,
    username: "reader",
  });
  expect(new Date(call.options.data.terms_accepted_at).getTime()).not.toBeNaN();
  expect(JSON.stringify(call)).not.toMatch(/birth|dob/i);
  expect(mockRouter.push).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/confirm-email" }),
  );
});
test("terms and privacy can be opened before account creation without submitting the form", async () => {
  await signup();
  for (const [title, path] of [
    ["Terms of Service", "/legal/terms"],
    ["Privacy Policy", "/legal/privacy"],
  ]) {
    await act(async () =>
      view.root
        .findAllByType("Pressable")
        .find(
          (p) =>
            p.props.accessibilityRole === "link" &&
            p.findAllByType("Text").some((t) => t.props.children === title),
        )
        .props.onPress(),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(path);
  }
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});
test("existing readers must affirm both checks and successfully save before continuing", async () => {
  mockPath = "/(tabs)/profile";
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "reader", user_metadata: {} } } },
  });
  await mount(<LegalAcceptanceGate />);
  expect(view.root.findByType("Modal").props.visible).toBe(true);
  expect(
    view.root
      .findAllByType("Pressable")
      .find((p) => p.props.accessibilityLabel === "Agree and continue").props
      .disabled,
  ).toBe(true);
  await pressLabel("I confirm I am 18 or older");
  await pressLabel(
    "I agree to the Terms of Service and acknowledge the Privacy Policy",
  );
  supabase.auth.updateUser.mockResolvedValue({
    data: { user: null },
    error: Error("offline"),
  });
  await pressLabel("Agree and continue");
  expect(view.root.findByType("Modal").props.visible).toBe(true);
  expect(
    view.root.findByProps({ accessibilityRole: "alert" }).props.children,
  ).toContain("Could not save");
  supabase.auth.updateUser.mockImplementation(async ({ data }) => ({
    data: { user: { id: "reader", user_metadata: data } },
    error: null,
  }));
  await pressLabel("Agree and continue");
  expect(view.root.findByType("Modal").props.visible).toBe(false);
});
test("legal reading and account deletion remain accessible to existing readers before acceptance", async () => {
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "reader", user_metadata: {} } } },
  });
  mockPath = "/legal/privacy";
  await mount(<LegalAcceptanceGate />);
  expect(view.root.findByType("Modal").props.visible).toBe(false);
  mockPath = "/delete-account";
  await act(async () => view.update(<LegalAcceptanceGate />));
  expect(view.root.findByType("Modal").props.visible).toBe(false);
});
test("current acceptance skips the prompt and a new unaccepted user reopens it", async () => {
  mockPath = "/(tabs)/profile";
  supabase.auth.getSession.mockResolvedValue({
    data: {
      session: {
        user: {
          id: "reader",
          user_metadata: {
            terms_version: LEGAL_VERSION,
            privacy_version: LEGAL_VERSION,
            adult_confirmed: true,
          },
        },
      },
    },
  });
  await mount(<LegalAcceptanceGate />);
  expect(view.root.findByType("Modal").props.visible).toBe(false);
  await act(async () =>
    mockAuthCallback("SIGNED_IN", {
      user: { id: "different", user_metadata: {} },
    }),
  );
  expect(view.root.findByType("Modal").props.visible).toBe(true);
  expect(
    acceptedCurrentTerms({
      terms_version: "old",
      privacy_version: LEGAL_VERSION,
      adult_confirmed: true,
    }),
  ).toBe(false);
});
