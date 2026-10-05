import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TeamFilter } from "../TeamFilter";

afterEach(cleanup);

const TEAMS = [
  { id: "t1", name: "Prvi tim" },
  { id: "t2", name: "Kadeti" },
];

function renderFilter(
  props: Partial<Parameters<typeof TeamFilter>[0]> = {}
) {
  return render(
    <TeamFilter
      teams={TEAMS}
      selectedTeamId="t1"
      teamHref={(teamId) => `/x?team=${teamId}`}
      ariaLabel="Tim"
      {...props}
    />
  );
}

describe("TeamFilter", () => {
  it("keeps the filled primary accent by default (main navigation look)", () => {
    renderFilter();
    const active = screen.getByRole("link", { name: "Prvi tim" });
    expect(active).toHaveClass("bg-primary", "text-primary-foreground");
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("uses a quiet primary tint for the soft filter tone", () => {
    renderFilter({ tone: "soft", label: "Tim" });

    expect(screen.getByText("Tim")).toBeInTheDocument();
    const active = screen.getByRole("link", { name: "Prvi tim" });
    expect(active).toHaveClass("bg-primary/10", "text-primary");
    expect(active).not.toHaveClass("bg-primary");
    expect(active).not.toHaveClass("text-primary-foreground");
  });

  it("adds and activates the all-teams option", () => {
    renderFilter({
      tone: "soft",
      selectedTeamId: null,
      allLabel: "Svi timovi",
      allHref: "/x",
    });

    const all = screen.getByRole("link", { name: "Svi timovi" });
    expect(all).toHaveAttribute("href", "/x");
    expect(all).toHaveClass("bg-primary/10");
    expect(all).toHaveAttribute("aria-current", "page");
  });
});
