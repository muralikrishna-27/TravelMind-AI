import { describe, expect, it } from "vitest";
import { parseItinerary } from "@/lib/parse-itinerary";

describe("parseItinerary", () => {
  it("parses standard ### Day N – Title headings and Markdown tables", () => {
    const sample = `### Day 1 – Arrival in Tokyo

| Time | Activity | Approx. Cost (₹) |
|---|---|---:|
| 09:00 | Senso-ji Temple, Asakusa | Free |
| 12:30 | Lunch at Tsukiji Outer Market | ₹1,800 |

Day 1 total: ≈ ₹1,800

### Day 2 – Old Tokyo and waterfront

| Time | Activity | Approx. Cost (₹) |
|---|---|---:|
| 15:00 | teamLab Planets | ₹2,500 |
| 19:00 | Dinner in Shibuya | ₹3,000 |

Day 2 total: ≈ ₹5,500`;

    const parsed = parseItinerary(sample);
    expect(parsed.hasStructuredDays).toBe(true);
    expect(parsed.days).toHaveLength(2);
    expect(parsed.days[0].dayNumber).toBe(1);
    expect(parsed.days[0].title).toBe("Arrival in Tokyo");
    expect(parsed.days[0].rows).toEqual([
      { time: "09:00", activity: "Senso-ji Temple, Asakusa", cost: "Free" },
      {
        time: "12:30",
        activity: "Lunch at Tsukiji Outer Market",
        cost: "₹1,800",
      },
    ]);
    expect(parsed.days[0].dayTotal).toBe("≈ ₹1,800");
    expect(parsed.days[1].title).toBe("Old Tokyo and waterfront");
  });

  it("handles ## Day N and ### **Day N** heading variations", () => {
    const sample = `## Day 1: Historic Kyoto

| Time | Activity | Cost |
|---|---|---|
| 10:00 | Fushimi Inari Shrine | Free |

### **Day 2 – Arashiyama Bamboo Grove**

| Time | Activity | Cost |
|---|---|---|
| 08:30 | Bamboo Forest Walk | Free |`;

    const parsed = parseItinerary(sample);
    expect(parsed.hasStructuredDays).toBe(true);
    expect(parsed.days).toHaveLength(2);
    expect(parsed.days[0].title).toBe("Historic Kyoto");
    expect(parsed.days[1].title).toBe("Arashiyama Bamboo Grove");
  });

  it("separates trailing summary footer from the final day", () => {
    const sample = `### Day 1 – City Highlights

| Time | Activity | Approx. Cost (₹) |
|---|---|---:|
| 10:00 | Grand Palace | ₹1,200 |

Day 1 total: ≈ ₹1,200

### Total Estimated Trip Cost
- Flights: ₹35,000
- Stay: ₹20,000

### Practical Tips
- Carry cash for local markets.`;

    const parsed = parseItinerary(sample);
    expect(parsed.hasStructuredDays).toBe(true);
    expect(parsed.days).toHaveLength(1);
    expect(parsed.days[0].extraMarkdown).not.toContain("Practical Tips");
    expect(parsed.summaryMarkdown).toContain("Total Estimated Trip Cost");
    expect(parsed.summaryMarkdown).toContain("Carry cash for local markets.");
  });

  it("falls back gracefully when no day headings exist", () => {
    const sample = `Here is a general flight and visa overview for Lisbon.\n\n- TAP Air Portugal operates daily routes.\n- Schengen visa required.`;
    const parsed = parseItinerary(sample);
    expect(parsed.hasStructuredDays).toBe(false);
    expect(parsed.days).toHaveLength(0);
    expect(parsed.rawMarkdown).toContain("TAP Air Portugal");
  });
});
