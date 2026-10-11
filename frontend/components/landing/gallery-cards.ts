export interface GalleryCardRow {
  label: string;
  value: string;
}

export interface GalleryCardItem {
  id: string;
  tag: string;
  title: string;
  liveDot?: boolean;
  rows?: GalleryCardRow[];
  traceLines?: string[];
}

export const GALLERY_CARDS: GalleryCardItem[] = [
  {
    id: "itinerary",
    tag: "Itinerary",
    title: "Tokyo, 5 days",
    rows: [
      { label: "09:00 Senso-ji", value: "Free" },
      { label: "12:30 Tsukiji lunch", value: "$20" },
      { label: "15:00 teamLab", value: "$30" },
    ],
  },
  {
    id: "weather",
    tag: "Weather",
    title: "Dubai weekend",
    rows: [
      { label: "Fri", value: "Sunny" },
      { label: "Sat", value: "Clear" },
      { label: "Sun", value: "Warm" },
    ],
  },
  {
    id: "flights",
    tag: "Flights",
    title: "Lisbon routes",
    rows: [
      { label: "Airports", value: "3 found" },
      { label: "Airlines", value: "Matched" },
      { label: "Route", value: "Direct" },
    ],
  },
  {
    id: "budget",
    tag: "Budget",
    title: "Bangkok, 4 days",
    rows: [
      { label: "Stay", value: "Mid-range" },
      { label: "Food", value: "Low" },
      { label: "Transit", value: "Low" },
    ],
  },
  {
    id: "hotels",
    tag: "Hotels",
    title: "Kyoto stays",
    rows: [
      { label: "Ryokan", value: "Top rated" },
      { label: "Central", value: "Near station" },
      { label: "Stay", value: "Quiet ward" },
    ],
  },
  {
    id: "revise",
    tag: "Revise",
    title: "Day 2 updated",
    rows: [
      { label: "Morning", value: "Kept as is" },
      { label: "Afternoon", value: "Rewritten" },
      { label: "Other days", value: "Unchanged" },
    ],
  },
  {
    id: "live-trace",
    tag: "Live trace",
    title: "Agent stream",
    liveDot: true,
    traceLines: [
      "flight list_airports done",
      "hotel search done",
      "weather get_forecast",
    ],
  },
  {
    id: "approved",
    tag: "Approved",
    title: "Final plan ready",
    liveDot: true,
    rows: [
      { label: "Review", value: "Approved" },
      { label: "Export", value: "Copy or PDF" },
      { label: "Status", value: "Locked in" },
    ],
  },
];
