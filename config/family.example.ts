/**
 * family.example.ts — template for all family-specific configuration.
 *
 * To set up this app for your household:
 *  1. Copy this file to config/family.ts  (it is gitignored — stays private).
 *  2. Replace every placeholder below with your real values.
 *  3. Deploy. The app reads from config/family.ts at runtime.
 *
 * To adapt for your household:
 *  - Replace the MEMBERS array with your own people.
 *    - calendar: true  → appears as a participant in schedule events
 *    - todos: true     → can be assigned to-do items (provide a todoColor)
 *    - mealPicker: true → appears in the meal eaters picker
 *    - schoolChild: true → used for go-home logic and school pick-up to-dos
 *  - Update CALENDAR_GROUPS if you want group aliases (e.g. "Family", "Household").
 *  - Update MEAL_SHORTCUTS for your household's common meal groupings.
 *  - Adjust GO_HOME thresholds to match your school's schedule.
 *  - Update FALLBACK_HOME_DEFAULTS for your typical weekly pattern.
 *  - Edit AUTO_GEN_RULES to match your household's recurring tasks.
 *  - Update ICS_PARTICIPANT_KEYWORDS if you sync a calendar feed.
 *  - Replace FAMILY_DESCRIPTION with a description for the AI chatbot.
 *  - Set PRIMARY_USER and STAFF_ASSIGNEE to the appropriate member IDs.
 */

import type { HomeMethod } from "@/lib/home-method";

// ─── App branding ─────────────────────────────────────────────────────────────

/**
 * Set to true to enable the Go Home feature — shows a transport chip on the
 * dashboard and weekly calendar indicating how the school child gets home.
 *
 * NOTE: Currently supports one school child only (the first member with
 * schoolChild: true). Multi-child support is not yet implemented.
 *
 * Set to false (default) to hide all Go Home UI and disable related auto-todos.
 */
export const ENABLE_GO_HOME = false;

/** Display name shown in the nav bar, PIN screen, and browser tab. */
export const APP_NAME = "Clawdia";

/** Path to the small mascot image used in the nav bar (36×36). */
export const MASCOT_FACE = "/clawdia-face.png";

/** Path to the larger mascot image used on the PIN screen (160×160). */
export const MASCOT_FULL = "/clawdia-full.png";

// ─── Timezone ─────────────────────────────────────────────────────────────────

export const TIMEZONE = "Asia/Hong_Kong";

// ─── Members ──────────────────────────────────────────────────────────────────

/** Derives bg / text / solid variants from a single hex colour. */
function colorVariants(hex: string): { bg: string; text: string; solid: string } {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { bg: `rgba(${r},${g},${b},0.12)`, text: hex, solid: hex }
}

/**
 * Every person (or role) in the household.
 * Types for Participant, TodoAssignee, and meal pickers are all derived from this.
 */
const MEMBERS = [
  {
    id: "alice",
    name: "Alice",
    initials: "A",
    calendar: true,
    todos: true,
    mealPicker: true,
    schoolChild: false,
    color: "#8b5cf6",
  },
  {
    id: "bob",
    name: "Bob",
    initials: "B",
    calendar: true,
    todos: false,
    mealPicker: true,
    schoolChild: false,
    color: "#4a7c6f",
  },
  {
    id: "child1",
    name: "Charlie",
    initials: "C",
    calendar: true,
    todos: true,
    mealPicker: true,
    schoolChild: true,
    color: "#0891b2",
  },
  {
    id: "pet",
    name: "Pet",
    initials: "P",
    calendar: true,
    todos: false,
    mealPicker: false,
    schoolChild: false,
    color: "#f59e0b",
  },
  {
    id: "helper",
    name: "Helper",
    initials: "H",
    calendar: false,
    todos: true,
    mealPicker: false,
    schoolChild: false,
    color: "#059669",
  },
] as const;

type AnyMember = (typeof MEMBERS)[number];

// ─── Derived types ────────────────────────────────────────────────────────────

type CalendarMember = Extract<AnyMember, { calendar: true }>;
type MemberParticipant = CalendarMember["id"];

/** Group aliases that can be used as participants in calendar events. */
export const CALENDAR_GROUPS = [{ value: "family", label: "Family" }] as const;

type GroupParticipant = (typeof CALENDAR_GROUPS)[number]["value"];

export type Participant = MemberParticipant | GroupParticipant;
export type TodoAssignee = Extract<AnyMember, { todos: true }>["id"];

// ─── Derived arrays ───────────────────────────────────────────────────────────

export const PARTICIPANTS: { value: Participant; label: string }[] = [
  ...MEMBERS.filter((m) => m.calendar).map((m) => ({
    value: m.id as Participant,
    label: m.name,
  })),
  ...CALENDAR_GROUPS.map((g) => ({
    value: g.value as Participant,
    label: g.label,
  })),
];

export const TODO_ASSIGNEES: { value: TodoAssignee; label: string }[] =
  MEMBERS.filter((m) => m.todos).map((m) => ({
    value: m.id as TodoAssignee,
    label: m.name,
  }));

export const ASSIGNEE_STYLE: Record<
  TodoAssignee,
  { bg: string; text: string; solid: string }
> = Object.fromEntries(
  MEMBERS.filter((m) => m.todos).map((m) => [m.id, colorVariants(m.color)]),
) as Record<TodoAssignee, { bg: string; text: string; solid: string }>;

/** Members who appear in the meal eaters picker. */
export const MEAL_MEMBERS = MEMBERS.filter((m) => m.mealPicker).map((m) => ({
  id: m.id,
  name: m.name,
  initials: m.initials,
  color: colorVariants(m.color),
}));

// ─── Member lookup helpers ────────────────────────────────────────────────────

export function getMemberName(id: string): string {
  return MEMBERS.find((m) => m.id === id)?.name ?? id;
}

export function getMemberInitials(id: string): string {
  return (
    MEMBERS.find((m) => m.id === id)?.initials ?? id[0]?.toUpperCase() ?? "?"
  );
}

export function getMemberColor(
  id: string,
): { bg: string; text: string; solid: string } | undefined {
  const m = MEMBERS.find((m) => m.id === id)
  return m ? colorVariants(m.color) : undefined
}

// ─── Roles ────────────────────────────────────────────────────────────────────

/** The participant tracked for school pick-up logic (must have schoolChild: true in MEMBERS). */
export const SCHOOL_CHILD = MEMBERS.find((m) => m.schoolChild)!
  .id as Participant;

/** The assignee who plans meals (Saturday auto-todo). Must have todos: true in MEMBERS. */
export const PRIMARY_USER: TodoAssignee = "alice";

/**
 * The default assignee for operational tasks (shopping, school pick-ups, etc.).
 * Must have todos: true in MEMBERS.
 *
 * If you have multiple staff with different responsibilities, you can override
 * the assignee on individual rules in AUTO_GEN_RULES below — any TodoAssignee
 * is valid there. STAFF_ASSIGNEE is used as the fallback for rules that don't
 * specify their own assignee.
 */
export const STAFF_ASSIGNEE: TodoAssignee = "helper";

// ─── Meal shortcuts ───────────────────────────────────────────────────────────

/**
 * Quick-select buttons in the meal eaters picker.
 * members must be IDs of meal-picker-eligible members.
 */
export const MEAL_SHORTCUTS: { label: string; members: string[] }[] = [
  { label: "Adults", members: ["alice", "bob"] },
  { label: "Kids", members: ["child1"] },
  { label: "Everyone", members: ["alice", "bob", "child1"] },
];

// ─── School ───────────────────────────────────────────────────────────────────

/** Display abbreviation for the school attended by the school child. */
export const SCHOOL_NAME = "School";

/** URL for the school's parent portal (used in GoHome settings). */
export const SCHOOL_PORTAL_URL = "https://yourschool.edu";

// ─── Go-home settings ─────────────────────────────────────────────────────────

/** Events ending after this time → Pickup (adult accompaniment needed). */
export const GO_HOME_PICKUP_AFTER = "16:10";

/** Events ending after this time (but not past PICKUP_AFTER) → Bus 4pm. */
export const GO_HOME_BUS_LATE_AFTER = "15:10";

/**
 * Default home method per weekday (1=Mon … 5=Fri).
 * Overrideable per-day via /settings/go-home (stored in MongoDB).
 */
export const FALLBACK_HOME_DEFAULTS: Record<number, HomeMethod> = {
  1: "pickup",   // Monday
  2: "bus-3pm",  // Tuesday
  3: "pickup",   // Wednesday
  4: "bus-3pm",  // Thursday
  5: "bus-3pm",  // Friday
};

// ─── Auto-gen todo rules ──────────────────────────────────────────────────────

export type AutoGenCondition =
  | { type: "go_home_pickup" }
  | { type: "appointment_for_school_child" }          // one item per matching appointment
  | { type: "day_of_week"; days: number[] }            // 0=Sun … 6=Sat
  | { type: "day_of_month"; days: number[] }           // 1–31
  | { type: "nth_weekday_of_month"; n: number; weekday: number } // n>0: 1st/2nd/…, n<0: last/-2nd/… occurrence of weekday (0=Sun…6=Sat)
  | { type: "days_before_event"; days: number; eventType?: string; participant?: string }; // N days before a matching event

export interface AutoGenRule {
  condition: AutoGenCondition;
  /**
   * Title template. Available placeholders:
   * {{schoolChild}}        — ID of the school child (all conditions)
   * {{appointmentTitle}}   — appointment title (appointment_for_school_child)
   * {{eventTitle}}         — upcoming event title (days_before_event)
   * {{eventDate}}          — upcoming event date YYYY-MM-DD (days_before_event)
   */
  title: string;
  assignee: TodoAssignee;
  /** Stable dedup key prefix. Date (and event ID for appointments) appended by evaluator. */
  autoGenKey: string;
}

export const AUTO_GEN_RULES: AutoGenRule[] = [
  {
    condition: { type: "go_home_pickup" },
    title: "Pick up {{schoolChild}} from school",
    assignee: STAFF_ASSIGNEE,
    autoGenKey: "pickup",
  },
  {
    condition: { type: "appointment_for_school_child" },
    title: "Accompany {{schoolChild}} to {{appointmentTitle}}",
    assignee: STAFF_ASSIGNEE,
    autoGenKey: "appt",
  },
  {
    condition: { type: "day_of_week", days: [6] },
    title: "Plan meals for the week",
    assignee: PRIMARY_USER,
    autoGenKey: "meal-plan",
  },
  {
    condition: { type: "day_of_week", days: [0] },
    title: "Shop for meal ingredients",
    assignee: STAFF_ASSIGNEE,
    autoGenKey: "meal-shop",
  },
  {
    condition: { type: "day_of_month", days: [1] },
    title: "Review household budget",
    assignee: PRIMARY_USER,
    autoGenKey: "budget-review",
  },
  {
    condition: { type: "nth_weekday_of_month", n: 1, weekday: 1 }, // first Monday
    title: "Monthly household review",
    assignee: PRIMARY_USER,
    autoGenKey: "monthly-review",
  },
  {
    condition: { type: "nth_weekday_of_month", n: -1, weekday: 4 }, // last Thursday
    title: "Pay monthly staff",
    assignee: PRIMARY_USER,
    autoGenKey: "pay-staff-thu",
  },
  {
    condition: { type: "nth_weekday_of_month", n: -1, weekday: 5 }, // last Friday
    title: "Pay monthly staff",
    assignee: PRIMARY_USER,
    autoGenKey: "pay-staff-fri",
  },
  {
    condition: { type: "days_before_event", days: 2, eventType: "travel" },
    title: "Pack bags for {{eventTitle}}",
    assignee: PRIMARY_USER,
    autoGenKey: "pack-travel",
  },
];

// ─── ICS feed participant detection ──────────────────────────────────────────

/**
 * Maps keywords found in calendar event titles to participant names.
 * Used by the ICS sync cron to auto-assign participants from imported events.
 */
export const ICS_PARTICIPANT_KEYWORDS: {
  keywords: string[];
  participant: Participant;
}[] = [
  { keywords: ["alice"], participant: "alice" },
  { keywords: ["bob"], participant: "bob" },
  { keywords: ["charlie", "child1"], participant: "child1" },
];

// ─── AI chatbot family description ───────────────────────────────────────────

/**
 * Injected into the AI chat system prompt.
 * Describe your household so the AI can refer to family members correctly.
 */
export const FAMILY_DESCRIPTION = `\
- **Alice** — mum, primary user
- **Bob** — dad
- **Charlie** — child (school-age)
- **Pet** — family pet
- **Helper** — household helper`;
