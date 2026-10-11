import path from "node:path";
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const AFTER_DIR = path.resolve(__dirname, "../../../design-reference/after");

const MOCK_CONSTRAINTS = {
  destination: "Tokyo",
  origin: "San Francisco",
  duration: "5 days",
  budget: "$2,400",
  travel_style: "mid-range",
  special_preferences: ["food", "temples"],
};

const MOCK_ITINERARY = `### Day 1 – Arrival in Shinjuku
| Time | Activity | Approx. Cost ($) |
|---|---|---:|
| 14:30 | Narita Express to Shinjuku Station & hotel check-in | $32 |
| 17:30 | Evening stroll through Omoide Yokocho lantern alleys | $24 |
| 20:00 | Ramen dinner at Fuunji Shinjuku | $14 |
Day 1 total: ≈ $70

### Day 2 – Old Tokyo and waterfront
| Time | Activity | Approx. Cost ($) |
|---|---|---:|
| 08:30 | Senso-ji & Nakamise-dori before the crowds | $8 |
| 11:30 | Kappabashi kitchenware street walk | $0 |
| 13:00 | Tempura lunch at Daikokuya | $28 |
| 15:30 | Water bus down the Sumida to Hamarikyu Gardens | $18 |
| 19:00 | Monjayaki dinner on Tsukishima Monja Street | $34 |
Day 2 total: ≈ $88

### Total Estimated Trip Cost
- **Flights:** $920 round-trip
- **Hotels:** $720 (4 nights)
- **Daily activities & dining:** $460
- **Practical tips:** Reserve Suica IC card on your phone before landing.
`;

const MOCK_REVIEW_PAYLOAD = {
  thread_id: "thread_tokyo_5d",
  answer: MOCK_ITINERARY,
  requires_approval: true,
  approval_request: "Please review the generated itinerary.",
  flight_results:
    "**SFO → HND** via ANA / JAL · Direct 11h 15m · Approx. $920 round-trip.",
  hotel_results:
    "**Shinjuku Granbell Hotel** · $165/night · 4.4★ · Close to metro and dining.",
  weather_results:
    "**Tokyo 5-day forecast:** 14–21°C, mostly clear skies with 1 light rain day.",
  budget_results:
    "**Estimated total:** ~$2,100 — comfortably within your $2,400 budget.",
  itinerary: MOCK_ITINERARY,
  selected_agents: [
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
  ],
  trip_constraints: MOCK_CONSTRAINTS,
  supervisor_reasoning: "Full 5-day Tokyo itinerary with flights, hotels, weather and budget.",
  guardrail_allowed: true,
  guardrail_reason: "",
  approved: false,
  human_feedback: "",
  llm_calls: 6,
};

test.beforeAll(() => {
  fs.mkdirSync(AFTER_DIR, { recursive: true });
});

test.describe("TravelMind AI — Responsive, Accessibility & Full Flow E2E", () => {
  test("Landing page (desktop & mobile) renders dark & light themes across 360/390/768/1440px, verifies network & console, passes axe, and captures screenshots", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const requestedUrls: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });
    page.on("request", (req) => {
      requestedUrls.push(req.url());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Trips planned by a team of agents/i })
    ).toBeVisible();

    const htmlTheme = await page.locator("html").getAttribute("data-theme");
    expect(htmlTheme).toBe("dark");

    // Verify tinted dark background token (#0b120e -> rgb(11, 18, 14))
    const bodyBg = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor
    );
    expect(bodyBg).toBe("rgb(11, 18, 14)");

    // Verify TechLogoStrip ("Built on" + 5 provider links with target="_blank" rel="noopener noreferrer")
    await expect(page.getByText("Built on", { exact: true })).toBeVisible();
    for (const provider of [
      "LangGraph",
      "Groq",
      "Tavily",
      "AviationStack",
      "OpenWeather",
    ]) {
      const link = page.getByRole("link", { name: provider });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }

    // Verify all 6 agent cards have dark theme artwork applied
    const agentSection = page.locator("#agents");
    const agentCards = page.locator("#agents .agent-card-bg");
    await expect(agentCards).toHaveCount(6);
    await agentSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const firstCardBgDark = await agentCards
      .first()
      .evaluate((el) => window.getComputedStyle(el).backgroundImage);
    expect(firstCardBgDark).toContain("01-supervisor-dark");

    // Verify Network tab: only dark agent-card images loaded while in dark theme
    const lightBgRequestsInDark = requestedUrls.filter((u) =>
      /agent-card-backgrounds\/.*-light\.(png|webp)/.test(u)
    );
    expect(lightBgRequestsInDark).toEqual([]);

    await agentSection.screenshot({
      path: path.join(AFTER_DIR, "agent-cards-dark.png"),
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    await page.screenshot({
      path: path.join(AFTER_DIR, "landing-desktop.png"),
      fullPage: true,
    });
    await page.screenshot({
      path: path.join(AFTER_DIR, "landing-dark-desktop.png"),
      fullPage: true,
    });

    const axeDarkDesktop = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      axeDarkDesktop.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
    ).toEqual([]);

    // Check dark theme across 1440, 768, 390, 360px
    for (const vp of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
    ]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
      if (vp.width === 390) {
        await page.screenshot({
          path: path.join(AFTER_DIR, "landing-mobile.png"),
          fullPage: true,
        });
        await page.screenshot({
          path: path.join(AFTER_DIR, "landing-dark-mobile.png"),
          fullPage: true,
        });
      }
    }

    // Toggle to Light theme at 1440px and verify artwork, axe, and viewports
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    await page
      .getByRole("button", { name: /Click to switch theme/i })
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const firstCardBgLight = await agentCards
      .first()
      .evaluate((el) => window.getComputedStyle(el).backgroundImage);
    expect(firstCardBgLight).toContain("01-supervisor-light");

    await agentSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await agentSection.screenshot({
      path: path.join(AFTER_DIR, "agent-cards-light.png"),
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: path.join(AFTER_DIR, "landing-light-desktop.png"),
      fullPage: true,
    });

    const axeLightDesktop = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      axeLightDesktop.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )
    ).toEqual([]);

    for (const vp of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
    ]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow).toBe(false);
    }

    expect(consoleErrors).toEqual([]);
  });

  test("GalleryScroller supports infinite auto-scroll, hover pause, keyboard navigation, and reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const scroller = page.getByRole("region", {
      name: /Sample agent output cards/i,
    });

    await expect(scroller).toBeVisible();
    await expect(page.locator('[data-gallery-card="primary"]')).toHaveCount(8);
    await expect(page.locator('[data-gallery-card="clone"]')).toHaveCount(8);

    // Verify infinite auto-scroll advances scrollLeft automatically
    const initialScroll = await scroller.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(350);
    const advancedScroll = await scroller.evaluate((el) => el.scrollLeft);
    expect(advancedScroll).toBeGreaterThan(initialScroll);

    // Jump to start with Home to deterministically verify start state
    await scroller.focus();
    await scroller.press("Home");
    await expect(scroller).toHaveAttribute("data-at-start", "true");
    await expect(scroller).toHaveAttribute("data-at-end", "false");

    // Keyboard ArrowRight scrolls one card right
    await scroller.press("ArrowRight");
    const scrollAfterArrowRight = await scroller.evaluate((el) => el.scrollLeft);
    expect(scrollAfterArrowRight).toBeGreaterThan(0);
    await expect(scroller).toHaveAttribute("data-at-start", "false");

    // Hover pause: hovering over the gallery keeps scrollLeft steady
    await scroller.hover();
    const scrollBeforeHoverWait = await scroller.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(300);
    const scrollAfterHoverWait = await scroller.evaluate((el) => el.scrollLeft);
    expect(scrollAfterHoverWait).toBe(scrollBeforeHoverWait);

    // Reduced motion disables clones and auto-scroll
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.locator('[data-gallery-card="primary"]')
    ).toHaveCount(8);
    await expect(
      page.locator('[data-gallery-card="clone"]')
    ).toHaveCount(0);
    await page.waitForTimeout(400);
    const reducedScrollLeft = await scroller.evaluate((el) => el.scrollLeft);
    expect(reducedScrollLeft).toBe(0);
  });

  test("Planner page (/app) renders light theme, presets, recent trips, and passes axe", async ({
    page,
  }) => {
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app");

    // Force light theme for screenshot parity with 1 · Home.png
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
      window.localStorage.setItem("tm_theme", "light");
      window.localStorage.setItem(
        "tm_threads_v1",
        JSON.stringify([
          {
            id: "thread_kyoto",
            title: "Kyoto & Osaka, 6 days",
            status: "awaiting_approval",
            updatedAt: Date.now() - 3600_000,
          },
          {
            id: "thread_lisbon",
            title: "Lisbon long weekend",
            status: "approved",
            updatedAt: Date.now() - 7200_000,
          },
          {
            id: "thread_reykjavik",
            title: "Reykjavik northern lights",
            status: "approved",
            updatedAt: Date.now() - 86400_000,
          },
        ])
      );
    });
    await page.reload();
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });

    await expect(
      page.getByRole("heading", { name: /Where to next\?/i })
    ).toBeVisible();

    await page.getByRole("button", { name: "Japan, 5 days" }).click();
    await expect(page.getByLabel(/Your trip/i)).toHaveValue(
      /5 days in Tokyo, mid-range budget, love food and temples/i
    );

    await page.screenshot({
      path: path.join(AFTER_DIR, "home.png"),
      fullPage: true,
    });

    const axePlanner = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const seriousViolations = axePlanner.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousViolations).toEqual([]);
  });

  test("Agents at work screen (desktop & mobile) renders rail + live trace and passes axe", async ({
    page,
  }) => {
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.route("**/api/travel/thread_working", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          thread_id: "thread_working",
          status: "streaming",
          user_query: "Tokyo, 5 days",
          trip_constraints: MOCK_CONSTRAINTS,
          payload: null,
          elapsed: 15,
          steps: {
            supervisor: "done",
            flight_agent: "done",
            hotel_agent: "running",
            weather_agent: "done",
            budget_agent: "queued",
            itinerary_agent: "queued",
          },
          traces: [
            {
              id: "tr-1",
              time: "00:01",
              agent: "supervisor",
              tool: "extract_constraints → Tokyo · 5d · $2,400 · food, temples",
              status: "done",
              active: false,
            },
            {
              id: "tr-2",
              time: "00:02",
              agent: "flight",
              tool: "aviationstack.flights → SFO → HND · 6 options",
              status: "done",
              active: false,
            },
            {
              id: "tr-3",
              time: "00:04",
              agent: "weather",
              tool: "openweather.forecast → Tokyo · 5-day · 14–21°C, 1 rain day",
              status: "done",
              active: false,
            },
            {
              id: "tr-4",
              time: "00:06",
              agent: "hotel",
              tool: 'tavily.search "Shinjuku boutique hotel under $180"',
              status: "",
              active: true,
            },
          ],
        }),
      });
    });

    // Keep SSE stream open during screenshot inspection
    await page.route("**/api/travel/thread_working/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"type":"step","agent":"hotel_agent","status":"running","tool":"tavily.search \\"Shinjuku boutique hotel under $180\\"","message":"Searching stays, neighborhoods and ratings…","t":15}\n\n',
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/trip/thread_working");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });

    await expect(
      page.getByRole("heading", { name: /Your team is on it\./i })
    ).toBeVisible();

    await page.screenshot({
      path: path.join(AFTER_DIR, "agents-at-work.png"),
      fullPage: true,
    });

    const axeAgents = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const seriousViolations = axeAgents.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousViolations).toEqual([]);

    // Mobile 390px screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(AFTER_DIR, "agents-at-work-mobile.png"),
      fullPage: true,
    });
  });

  test("Review & Approval screen (desktop & mobile) and Final approved flow", async ({
    page,
  }) => {
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.route("**/api/travel/thread_tokyo_5d", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          thread_id: "thread_tokyo_5d",
          status: "awaiting_approval",
          user_query: "5 days in Tokyo",
          trip_constraints: MOCK_CONSTRAINTS,
          payload: MOCK_REVIEW_PAYLOAD,
          elapsed: 22,
        }),
      });
    });

    await page.route("**/api/travel/approve", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          ...MOCK_REVIEW_PAYLOAD,
          requires_approval: false,
          approved: true,
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/trip/thread_tokyo_5d");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });

    await expect(
      page.getByRole("heading", { name: /Draft itinerary/i })
    ).toBeVisible();

    // Switch to Day 2 tab to match 3 · Review and approve.png
    await page.getByRole("tab", { name: "Day 2" }).click();
    await expect(
      page.getByRole("heading", { name: /Old Tokyo and waterfront/i })
    ).toBeVisible();

    await page.screenshot({
      path: path.join(AFTER_DIR, "review.png"),
      fullPage: true,
    });

    const axeReview = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const seriousViolations = axeReview.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(seriousViolations).toEqual([]);

    // Mobile 390px screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(AFTER_DIR, "review-mobile.png"),
      fullPage: true,
    });

    // Click Approve on desktop and verify transition to Final approved view
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Approve plan" }).click();

    await expect(
      page.getByRole("heading", { name: /Your Tokyo itinerary/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download PDF/i })
    ).toBeVisible();
  });
});
