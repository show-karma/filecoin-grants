import { describe, expect, it } from "vitest";
import { FALLBACK_COUNTS } from "../../lib/karma";
import { buildHeadlineStats } from "../landing";
import { isMenu, MAIN_NAV } from "../nav";
import { EXTERNAL, PROGRAM_ID, PROGRAM_PROJECTS_URL } from "../site";

/**
 * Two listings live in the app and they are not the same set: "Projects
 * Explorer" is everything submitted to the programmes (the app's own tab bar
 * calls it "Browse Projects"), while `/projects` is the narrower funded-grants
 * list, whose tab this tenant hides.
 *
 * The header pointed at the second one and said the first one's name. These
 * pin the two apart, and pin the header onto the URL the app's navbar and tab
 * also use — the three are meant to read as one destination.
 */
describe("Funding > Projects Explorer", () => {
  const fundingMenu = MAIN_NAV.find((entry) => entry.label === "Funding");

  const explorerItem = (() => {
    if (!fundingMenu || !isMenu(fundingMenu)) {
      throw new Error("The Funding menu is missing from MAIN_NAV.");
    }
    return fundingMenu.items?.find(
      (item) => item.label === "Projects Explorer",
    );
  })();

  it("points at the app's Browse Projects listing", () => {
    expect(explorerItem?.href).toBe("https://app.filpgf.io/browse-projects");
  });

  it("does not point at the funded-grants listing", () => {
    expect(explorerItem?.href).not.toBe(EXTERNAL.fundedProjects);
  });

  it("is unfiltered — the explorer is every programme, not one batch", () => {
    expect(explorerItem?.href).not.toContain("programId");
  });
});

describe("the Committed to date stat", () => {
  it("still links the funded-grants listing, scoped to the batch", () => {
    const committed = buildHeadlineStats(FALLBACK_COUNTS).find(
      (stat) => stat.label === "Committed to date",
    );

    expect(committed?.href).toBe(PROGRAM_PROJECTS_URL);
    expect(PROGRAM_PROJECTS_URL).toBe(
      `${EXTERNAL.fundedProjects}?programId=${PROGRAM_ID}`,
    );
  });
});
