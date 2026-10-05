import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { AppShell } from "../AppShell";
import type { NavItem } from "@/lib/rbac";

vi.mock("next/navigation", () => ({
  usePathname: () => "/sr/players",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => {
  const messages: Record<string, Record<string, string>> = {
    navigation: {
      goHome: "Početna",
      logout: "Odjavi se",
      more: "Više",
      close: "Zatvori",
    },
    common: { appName: "STOŽER" },
  };
  return {
    useTranslations: (ns: string) => (key: string) => messages[ns]?.[key] ?? key,
  };
});

afterEach(cleanup);

const navItems: NavItem[] = [
  { label: "Početna", href: "", icon: "Home" },
  { label: "Timovi", href: "/teams", icon: "Shield" },
  { label: "Igrači", href: "/players", icon: "UserRound" },
];

/**
 * The global header is brand-only and truly centered: the current section
 * title ("Igrači", "Timovi", …) must never render next to the STOŽER wordmark
 * — it belongs to the page content header.
 */
describe("AppShell global header", () => {
  it("renders the brand centered and no current section title", () => {
    const { container } = render(
      <AppShell
        navItems={navItems}
        orgName="Test Klub"
        userEmail="trener@example.com"
        userInitials="TK"
        logoutLabel="Odjavi se"
        moreLabel="Više"
        closeLabel="Zatvori"
      >
        <div>Sadržaj</div>
      </AppShell>
    );

    const header = container.querySelector("header");
    expect(header).not.toBeNull();

    // The Stožer brand lives in the header (logo + wordmark as one link)…
    const brand = within(header!).getByRole("link", { name: "Početna" });
    expect(brand).toHaveTextContent("STOŽER");

    // …and the current section title does NOT (it belongs to the content).
    expect(within(header!).queryByText("Igrači")).toBeNull();
    expect(within(header!).queryByText("Timovi")).toBeNull();

    // True centering: symmetric 1fr side columns so left/right controls can
    // never push the brand off the header's center.
    expect(header!.className).toContain("grid-cols-[1fr_auto_1fr]");

    // The page content renders below, untouched.
    expect(within(container).getByText("Sadržaj")).toBeInTheDocument();
  });
});
