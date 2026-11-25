# Air Almanac — Winter Smog & Urban Air Navigation Dashboard

A minimalist civic weather and air-quality dashboard that pairs real-time Open-Meteo pollution and meteorological forecasts with structured, auto-generated GenAI briefings to help families navigate severe winter smog, plan safe outdoor windows, adopt low-emission daily routines, and understand the direct health and environmental impact of every choice.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The plan below locks in your confirmed Phase 1 preferences alongside recommended architectural defaults. Review and approve to start building, or let me know if you want to adjust any detail.

- **Visual Direction (Confirmed)**: Nordic Civic Instrument — Warm Stone canvas (`#F7F5F0`), crisp flat white/stone surfaces, 1px hairline dividers, Ink (`#181715`) typography, tabular numerals, and zero AI-cliché gradients, floating pill badges, or chat clutter.
- **Location & Forecast Data (Confirmed)**: Live integration with Open-Meteo's Air Quality, Weather Forecast, and Geocoding APIs (no external weather API key needed), supporting browser geolocation auto-detect, global city search, and **New Delhi, India** as the initial default city.
- **Core Scope (Confirmed)**: Streamlined daily briefing and safe activity planner — real-time smog alerts, 48-hour hourly pollution & wind-dispersion charts, safest-window activity timeline, tailored low-emission routine swaps, indoor air quality hacks, and direct exposure/emission impact explanations.
- **GenAI Delivery (Confirmed)**: Structured auto-generated guidance without chat UI — automatically regenerated via a server-side Gemini (`gemini-4-hydrogen`) endpoint whenever the city or household profile changes, with interactive commitment toggles to measure cumulative household impact.
- **Persistence Default (Recommended)**: Household profile, saved cities, and daily committed low-emission actions persist locally in browser storage (`localStorage`) for instant zero-login access across sessions.

---

## 1. Overview & Core Concept

- **What It Does**: Air Almanac translates raw atmospheric telemetry (PM2.5, PM10, NO₂, O₃, SO₂, CO, temperature, humidity, wind dispersion, and thermal inversion risk) into a calm, legible morning and all-day decision instrument. Rather than forcing users to prompt a chatbot, it automatically synthesizes local Open-Meteo conditions with the household's real-world setup to surface:
  1. **Real-Time Smog Alerts & Dispersion Outlook**: Clear severity classification (never hue-only—always paired with explicit civic labels and respiratory advisory bands) plus why smog is trapping today (e.g., low wind speed and cold overnight inversion).
  2. **Safe Activity Window Planner**: An interactive 24–48 hour timeline pinpointing the lowest-exposure windows for school commutes, walking, jogging, and cross-ventilation.
  3. **Tailored Daily Briefing & Action Ledger**: Auto-generated, non-generic **Low-Emission Daily Routines**, **Indoor Air Quality Hacks**, and **Sustainable Alternatives**, each paired with a concrete **Direct Impact** line (estimated PM2.5 inhalation reduction and avoided CO₂e / NOₓ emissions).
  4. **Interactive Daily Impact Ledger**: Users can check off actions they commit to today and immediately see their household's cumulative avoided emissions and indoor exposure reduction update live.
- **Target Audience / Persona**: Urban families (parents with school-age children, seniors, individuals with asthma or respiratory sensitivity) and community organizers living in winter smog corridors who need trustworthy, fast morning guidance without noisy dashboards.
- **Key Value**: Bridges the gap between *reading a scary AQI number* and *knowing exactly when to ventilate, how to protect indoor air affordably, and what concrete difference a lower-emission commute or cooking swap makes today*.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Zero-State & Instant Load**:
   - Opens directly into the **New Delhi** live forecast (or the user's last saved city) with a clean one-click **Use my location** button and fast global city search combobox in the workspace toolbar.
   - While Open-Meteo telemetry and the structured Gemini briefing load, matched-geometry hairline skeleton rows appear without layout shift.
2. **Real-Time Condition & Alert Inspection**:
   - If US AQI exceeds unhealthy thresholds or thermal inversion conditions are detected, a calm, high-contrast civic alert strip appears directly above the main readout detailing the dominant pollutant, respiratory guidance, and next expected clearing window.
   - The primary focal anchor displays current US AQI, dominant pollutant (`PM2.5` in µg/m³), WHO guideline multiple (e.g., `18.4× WHO 24h limit`), and weather dispersion metrics (wind speed, humidity, temperature, visibility) in crisp tabular figures.
3. **48-Hour Smog & Safe Window Exploration**:
   - Users switch between **PM2.5 / AQI**, **Multi-Pollutant Breakdown (PM10, NO₂, O₃)**, and **Wind & Inversion Dispersion** on a custom SVG precision chart featuring a vertical hairline crosshair and exact hourly readout on hover/touch.
   - Adjacent to the chart sits the **Safe Activity Planner**, rating specific everyday activities (Morning Walk, School Commute, Window Ventilation, Outdoor Play, Evening Exercise) with recommended time slots and mask/filtration guidance.
4. **Household Profile Calibration & Auto-Briefing**:
   - Users adjust compact segmented controls in the **Household Profile** drawer or inline bar (Sensitivity group, Primary commute, Home heating/cooking, Indoor air setup).
   - Updating the profile automatically refreshes the structured Gemini briefing (with a clear subtle refreshing state and manual refresh button) to regenerate tailored routines, indoor hacks, and sustainable swaps.
5. **Action Commitment & Impact Tracking**:
   - Within the structured **Action & Routine Ledger**, users filter between *All*, *Low-Emission Routines*, *Indoor Air Hacks*, and *Sustainable Alternatives*, expand any item to read its full step-by-step rationale and health/climate mechanism, and toggle **Commit Today** to accumulate real-time estimated CO₂e saved and indoor PM2.5 reduction in the summary bar.

### Visual Identity & Theme

- **Aesthetic Direction**: **Nordic Civic Instrument** — inspired by Scandinavian meteorological almanacs, Braun/Swiss print tables, and calm editorial data journalism. Zero neon glows, zero purple/teal SaaS gradients, zero floating rounded-pill badge clusters, zero fake system telemetry tickers.
- **Color Palette & Mood (60–30–10 Distribution)**:
  - **60% Dominant Canvas (`--background`)**: Warm Stone `#F7F5F0` — glare-free paper tone suited for morning checks.
  - **30% Structural Surfaces (`--surface`, `--surface-muted`, `--border`)**: Crisp Alabaster `#FFFFFF`, Soft Limestone `#EFECE6`, and 1px hairline borders `#E2DDD3`.
  - **Primary Ink (`--foreground`, `--muted-foreground`)**: Deep Charcoal Ink `#181715` and Muted Slate Stone `#5E5A52` (WCAG AA/AAA contrast).
  - **10% Accent & Semantic Air Scale (`--primary`, `--accent`)**:
    - Primary interactive ink/accent: Civic Pine `#1F4E43` (used strictly for active controls, committed toggles, and primary actions).
    - Calibrated Air Quality Semantic Ramp (always paired with explicit text labels—never hue alone):
      - Good: Moss `#2D6A4F`
      - Moderate: Ochre `#9A6B16`
      - Sensitive / Unhealthy: Burnt Terracotta `#B84A27`
      - Very Unhealthy / Hazardous: Deep Oxblood `#7F1D1D`
- **Typography & Hierarchy (2+1 Font Rule)**:
  - **Display & Headings**: `Plus Jakarta Sans` (weights 500–600, `text-wrap: balance`, tight letter-spacing for calm authority).
  - **Body Prose**: `DM Sans` (15px–16px, 1.55 line-height, 65ch measure for effortless morning reading).
  - **Data, Coordinates, Timestamps & Measurements**: `IBM Plex Mono` (`font-variant-numeric: tabular-nums`) so AQI values, µg/m³ concentrations, and hourly timestamps align vertically with zero jitter.
- **Component Styling & Layout**:
  - **Strict 3-Zone Top Bar Contract**: Single-row header (`gap-8`) containing: (1) single-line wordmark `Air Almanac`, (2) four single-line section links (`Overview`, `Forecast`, `Activity Planner`, `Daily Actions`), and (3) one primary action button (`Household Profile`). Location search and geolocation controls live cleanly inside the main workspace toolbar below the header.
  - **Flat Single-Elevation Grids**: 1440px desktop baseline with a `max-w-[1240px]` centered container, hairline `1px` borders, generous whitespace, no cards-within-cards, and no thick left accent stripes (`border-l-4`).
  - **Zero-Pill Metadata**: Pollutant readings, timestamps, categories, and WHO comparisons render as unboxed inline text separated by middots (`·`), reserving button styling exclusively for real interactive filters and toggles.
- **Interactive Feedback & Motion**:
  - Snappy $\le 180\text{ms}$ `cubic-bezier(0.16, 1, 0.3, 1)` transitions for tab switches, crosshair tracking, expandable impact details, and action commitments (respecting `prefers-reduced-motion`).
  - Complete populated, loading (skeletons), empty (no city search matches), and error states (clear retry banner if Open-Meteo or Gemini fails—never silent mock fallbacks).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Express API Layer for Gemini & Weather Aggregation**
  - *Chosen Approach*: Run an Express server alongside Vite serving two dedicated API routes: one proxying/combining Open-Meteo Air Quality, Weather, and Geocoding data (with short in-memory caching) and one calling `@google/genai` (`gemini-4-hydrogen`) with strict JSON `responseSchema`.
  - *Why*: Keeps `GEMINI_API_KEY` strictly on the server, prevents browser rate-limit spikes when switching tabs, and guarantees strongly typed JSON cards that render cleanly into our Nordic Civic Instrument layout without unpredictable markdown blobs.
  - *Alternatives Considered*: Free-form streaming chat was passed over per your preference for structured, non-chat guidance; client-side API calls were rejected to follow server-side Gemini best practices.
- **Decision 2: Custom Precision SVG Data Visualizations vs. Heavy Charting Wrappers**
  - *Chosen Approach*: Build bespoke, responsive SVG charts (48-hour AQI/PM2.5 dual-layer dispersion chart with WHO threshold reference line, interactive crosshair probe, and hourly activity safety strip) styled with our exact hairline ink and tabular monospace tokens.
  - *Why*: Generic charting libraries often look boxy or clash with minimalist editorial typography; precision SVG charts stay razor-sharp on retina screens, zero-dependency, fast, and respond instantaneously to hover/touch scrubbing.
  - *Alternatives Considered*: Standard charting libraries (Recharts/Chart.js) add bundle weight and default styling that often reads as generic SaaS dashboards.
- **Decision 3: Deterministic Activity Window Scoring + GenAI Tailored Synthesis**
  - *Chosen Approach*: Compute exact safe/caution/avoid hourly windows deterministically from Open-Meteo's live hourly PM2.5, US AQI, and wind data, then pass those exact numbers and the household profile into Gemini to generate specific, localized daily routines, indoor air hacks, sustainable alternatives, and impact explanations.
  - *Why*: Guarantees the safe-time windows and pollutant math are 100% faithful to real Open-Meteo numbers (zero hallucinated forecasts), while letting Gemini shine at contextual lifestyle coaching and clear cause-and-effect explanations.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React + Tailwind)                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: [Air Almanac]  —  [Overview · Forecast · Planner · Actions]   │  │
│  │                         —  [Household Profile CTA]                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌─────────────────────────── State & Persistence ────────────────────────┐  │
│  │ • Selected Location (Delhi default / GPS / Open-Meteo search)          │  │
│  │ • Household Profile (sensitivity, commute, heating, indoor setup)      │  │
│  │ • Committed Daily Actions (persisted by date in localStorage)          │  │
│  └───────────────┬────────────────────────────────────────┬───────────────┘  │
│                  │                                        │                  │
│                  ▼                                        ▼                  │
│  ┌───────────────────────────────┐      ┌─────────────────────────────────┐  │
│  │ Live Atmospheric View         │      │ Structured GenAI Guidance       │  │
│  │ • Workspace Location Bar      │      │ • Civic Smog Alert & Summary    │  │
│  │ • Primary AQI & WHO Anchor    │      │ • Low-Emission Daily Routines   │  │
│  │ • Pollutant Breakdown Table   │      │ • Indoor Air Quality Hacks      │  │
│  │ • 48h Precision SVG Forecast  │      │ • Sustainable Alternatives      │  │
│  │ • Safe Activity Time Planner  │      │ • Quantified Impact Ledger      │  │
│  └───────────────┬───────────────┘      └─────────────────┬───────────────┘  │
└──────────────────┼────────────────────────────────────────┼──────────────────┘
                   │ GET /api/air-data                      │ POST /api/briefing
                   │ GET /api/geocode                       │
                   ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Express + TypeScript)                        │
│                                                                              │
│  ┌───────────────────────────────┐      ┌─────────────────────────────────┐  │
│  │ Open-Meteo Integration Layer  │      │ Gemini Briefing Service         │  │
│  │ • Air Quality API (48h hourly │      │ • @google/genai (server-only)   │  │
│  │   US/EU AQI, PM2.5, PM10,     │      │ • Model: gemini-4-hydrogen      │  │
│  │   NO2, O3, SO2, CO)           │      │ • Strict JSON responseSchema    │  │
│  │ • Weather API (temp, RH,      │      │ • Grounds advice in exact       │  │
│  │   wind, visibility, pressure) │      │   hourly metrics + profile      │  │
│  │ • Geocoding API (city search) │      │ • Propagates explicit API       │  │
│  │ • Inversion & Window Analyzer │      │   errors cleanly to UI          │  │
│  └───────────────────────────────┘      └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Location**: `{ name, admin1, country, latitude, longitude, timezone }` — initialized to New Delhi (`28.6139, 77.2090`) or last user selection.
- **AtmosphericSnapshot**: Current + 48-hour hourly arrays from Open-Meteo combining `us_aqi`, `european_aqi`, `pm2_5`, `pm10`, `nitrogen_dioxide`, `ozone`, `sulphur_dioxide`, `carbon_monoxide`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `visibility`, and derived fields (`dominantPollutant`, `whoMultiple`, `inversionRisk`, `bestVentilationWindow`, `activityWindows`).
- **HouseholdProfile**: `{ sensitivity: 'general' | 'children' | 'seniors' | 'respiratory', commute: 'car' | 'two_wheeler' | 'transit' | 'walk_cycle', heatingCooking: 'gas' | 'electric' | 'solid_fuel', indoorSetup: 'hepa_purifier' | 'ac_filter' | 'natural_ventilation', householdSize: number }`.
- **DailyBriefing** (Gemini Structured JSON):
  - `headlineSummary`: Concise plain-English meteorological & smog briefing for today.
  - `inversionExplanation`: Why pollutants are accumulating or clearing locally right now.
  - `alertGuidance`: Immediate protective alert headline + 3 concise bullet actions when AQI is elevated.
  - `activityNotes`: Personalized guidance mapped to the deterministic outdoor/indoor activity slots.
  - `recommendations`: Array of categorized items (`routine` | `indoor_hack` | `sustainable_alternative`), each containing `id`, `category`, `title`, `effort`, `timeframe`, `steps`, `directHealthImpact`, `directEmissionImpact`, `estimatedCo2KgSaved`, and `estimatedExposureDropPct`.

### Interactive Component & State Mapping

- **Location Search & Geolocation Bar**: Typing queries `/api/geocode?q=...` (debounced 250ms) and displays keyboard-navigable city results; clicking **Use my location** invokes browser geolocation + reverse coordinates lookup; selecting a city triggers `/api/air-data` followed automatically by `/api/briefing`.
- **Household Profile Drawer**: Slide-over calibration panel triggered by the Top Bar CTA (and accessible from the briefing header). Changing any segment updates `HouseholdProfile`, persists to `localStorage`, and triggers a fresh `/api/briefing` request with live loading feedback.
- **48-Hour Precision Chart & Metric Switcher**: Segmented toggle switches active series (`AQI & PM2.5`, `Gases & Coarse Dust`, `Wind & Humidity`). Hovering or touching the chart moves a snapped vertical crosshair and updates an inline tabular inspection bar with exact hour, pollutant concentration, wind speed, and status label.
- **Safe Activity Planner**: Interactive day toggle (`Today` / `Tomorrow`) updating recommended windows for 5 daily activities (School Commute, Outdoor Walk/Run, Home Cross-Ventilation, Kids Outdoor Play, Evening Errands) with explicit safety ratings and mask/filtration advice.
- **Daily Action Ledger & Impact Calculator**: Category filter tabs (`All`, `Low-Emission Routines`, `Indoor Air Hacks`, `Sustainable Alternatives`), expandable "Why this matters" impact breakdown per row, and working `Commit` checkboxes that recalculate total household `kg CO₂e avoided today` and `estimated indoor PM2.5 exposure reduction` in real time.
- **Error Recovery**: Network or API errors display an inline civic notice with the exact error reason and a working **Retry** button without masking failures behind fake data.

### Key Sequences & Integrations

1. **Open-Meteo Data Fetch**: Server calls `air-quality-api.open-meteo.com/v1/air-quality` and `api.open-meteo.com/v1/forecast` in parallel for the selected coordinates, aligns hourly timestamps to local timezone, computes inversion risk and safe time windows, and returns a unified payload.
2. **Gemini Structured Briefing**: Server calls `ai.models.generateContent` using `gemini-4-hydrogen` (upgrading `@google/genai` to `>= 2.29.1` and passing `User-Agent: 'aistudio-build'`) with `responseMimeType: "application/json"` and an explicit `Type.OBJECT` `responseSchema` grounded in the live Open-Meteo metrics and user's `HouseholdProfile`.
