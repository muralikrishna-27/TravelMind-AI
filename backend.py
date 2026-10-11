import os
import sys
import certifi
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import re
from typing import Any, TypedDict, Annotated
import operator
import uuid
import asyncio
import json
import psycopg
from psycopg.rows import dict_row
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command, interrupt
from langchain_core.messages import (
        AnyMessage,
        HumanMessage,
        AIMessage,
        SystemMessage,
)
from langchain_groq import ChatGroq
from mcp_client import (
        tavily_mcp_search,
        aviation_mcp_call,
        extract_destination,
        forecast_mcp_search,
        weather_mcp_search,
)


load_dotenv()
#used to prevent path issues*
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

# db connection
def get_database_url():
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
                raise ValueError(
                        "DATABASE_URL is missing. Please add your Render PostgreSQL External Database URL to .env"
                )
        if "sslmode=" not in database_url:
                separator = "&" if "?" in database_url else "?"
                database_url = f"{database_url}{separator}sslmode=require"
        return database_url

# llm key verification
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing. Please add it to your .env file.")
# 120B is reserved for the complete initial itinerary.
MAIN_MODEL = os.getenv("MAIN_MODEL", "openai/gpt-oss-120b")
# Smaller model handles routing, specialist analysis and revisions.
FAST_MODEL = os.getenv("FAST_MODEL", "openai/gpt-oss-20b")

# llm connection
itinerary_llm = ChatGroq(
    model=MAIN_MODEL,
    api_key=GROQ_API_KEY,
    max_tokens=4096,
    reasoning_effort="low",
)
fast_llm = ChatGroq(
    model=FAST_MODEL,
    api_key=GROQ_API_KEY,
    max_tokens=700,
    temperature=0,
    reasoning_effort="low",
)
specialist_llm = ChatGroq(
    model=FAST_MODEL,
    api_key=GROQ_API_KEY,
    max_tokens=1200,
    reasoning_effort="low",
)
revision_llm = ChatGroq(
    model=FAST_MODEL,
    api_key=GROQ_API_KEY,
    max_tokens=3500,
    reasoning_effort="low",
)
day_selector_llm = ChatGroq(
    model=FAST_MODEL,
    api_key=GROQ_API_KEY,
    max_tokens=250,
    temperature=0,
    reasoning_effort="low",
)



class TravelState(TypedDict, total=False):
        messages: Annotated[list[AnyMessage], operator.add]
        user_query: str

        # Supervisor + guardrail state to protect the privacy and intention of the userquery according to the agent*
        guardrail_allowed: bool
        guardrail_reason: str
        selected_agents: list[str]
        trip_constraints: dict[str, Any]
        supervisor_reasoning: str

        # Original specialist results*
        flight_results: str
        hotel_results: str
        weather_results: str
        itinerary: str

        # New budget + HITL state*
        budget_results: str
        approval_request: str
        approved: bool
        human_feedback: str
        final_response: str

        llm_calls: int

MAX_TRIP_DAYS = 7
# helpers*
KNOWN_AGENTS = {
        "flight_agent",
        "hotel_agent",
        "weather_agent",
        "budget_agent",
        "itinerary_agent",
}

AGENT_ORDER = [
        "flight_agent",
        "hotel_agent",
        "weather_agent",
        "budget_agent",
        "itinerary_agent",
]
DAY_PATTERN = re.compile(
    r"(?ms)^#{2,4}\s*(?:\*\*|__)?Day\s+(\d+)(?:\*\*|__)?\s*[-–—‑‐−:]\s*.*?(?=^#{2,4}\s*(?:\*\*|__)?Day\s+\d+(?:\*\*|__)?\s*[-–—‑‐−:]|^(?:#{1,4}\s*(?:\*\*|__)?(?:Total\s+Estimated|Trip\s+Summary|Summary|Practical\s+Tips|Important\s+Travel|Estimated\s+Total|Budget\s+Summary|Overall\s+Cost|Travel\s+Tips|Final\s+Notes)|\*\*(?:Total\s+estimated\s+trip\s+cost|Practical\s+tips|Important\s+travel\s+considerations)\*\*)|\Z)"
)


def _llm_text(system_prompt: str, user_prompt: str) -> str:
        response = fast_llm.invoke(
                [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt),
                ]
        )
        return str(response.content)


# using json formatt coz it would be easy to communate b/w agents*
def _json_from_llm(text: str) -> dict[str, Any]:
        """Extract the first complete JSON object returned by the model."""
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end < start:
                raise ValueError("The model did not return a JSON object.")
        return json.loads(text[start : end + 1])


def _validate_trip_duration(query: str) -> str | None:
    match = re.search(r"\b(\d+)\s*(?:day|days)\b", query, re.IGNORECASE)
    if match:
        days = int(match.group(1))
        if days > MAX_TRIP_DAYS:
            return f"Trip duration cannot exceed {MAX_TRIP_DAYS} days. Please choose a trip between 1 and {MAX_TRIP_DAYS} days."
    return None


def _empty_constraints() -> dict[str, Any]:
        return {
                "destination": "",
                "origin": "",
                "duration": "",
                "budget": "",
                "travel_style": "",
                "special_preferences": [],
        }

def _compact_text(value: Any, max_chars: int = 6000) -> str:
        """
        Compact tool output without blindly cutting the beginning/end of useful data.
        Keeps the complete result when it is already small.
        For oversized results, tries to parse JSON and keeps a compact representation.
        """
        if value is None:
                return ""
        if isinstance(value, (dict, list)):
                try:
                        return json.dumps(
                                value,
                                ensure_ascii=False,
                                separators=(",", ":")
                        )
                except Exception:
                        return str(value)
        return str(value)


# supervisor and guardial agents*
def supervisor_agent(state: TravelState):
        query = state["user_query"]
        llm_calls = state.get("llm_calls", 0)
        duration_error = _validate_trip_duration(query)
        if duration_error:
            return {
                "guardrail_allowed": False,
                "guardrail_reason": duration_error,
                "selected_agents": [],
                "trip_constraints": _empty_constraints(),
                "supervisor_reasoning": duration_error,
                "final_response": duration_error,
                "messages": [AIMessage(content=duration_error)],
                "llm_calls": llm_calls,
            }

        guardrail_prompt = f"""
Determine whether the following request belongs to travel planning or travel
information. Valid requests can include destinations, flights, hotels, weather,
budgets, visas, transportation, sightseeing, food, packing, or itineraries.
Block clearly unrelated requests and requests asking for harmful or illegal
instructions. Do not block a valid travel request merely because some details
are missing.
Return strict JSON only:
{{
        "allowed": true,
        "reason": ""
}}
User request:
{query}
"""
        # Fail open on parser/model errors so a temporary JSON-format issue does not*
        # break the original travel-planning behavior.*
        try:
                guardrail_raw = _llm_text(
                        "You are the input guardrail for a travel-planning application. "
                        "Return strict JSON only.",
                        guardrail_prompt,
                )
                guardrail_result = _json_from_llm(guardrail_raw)
                allowed = bool(guardrail_result.get("allowed", True))
                guardrail_reason = str(guardrail_result.get("reason", "")).strip()
                llm_calls += 1
        except Exception as exc:
                print(f"Guardrail fallback used: {exc}")
                allowed = True
                guardrail_reason = "Guardrail validation fallback allowed the request."
        if not allowed:
                reason = guardrail_reason or (
                        "TravelMind AI can only help with travel-planning requests. "
                        "Please ask about a destination, flight, hotel, weather, budget, "
                        "or itinerary."
                )
                return {
                        "guardrail_allowed": False,
                        "guardrail_reason": reason,
                        "selected_agents": [],
                        "trip_constraints": _empty_constraints(),
                        "supervisor_reasoning": reason,
                        "final_response": reason,
                        "messages": [AIMessage(content=f"Guardrail blocked request: {reason}")],
                        "llm_calls": llm_calls,
                }

        supervisor_prompt = f"""
You are the supervisor of a multi-agent travel-planning system.
Choose only the specialist agents needed for the request.
Available agents:
- flight_agent: flights, airports, airlines, routes, airfare, or booking advice
- hotel_agent: hotels, accommodation, neighborhoods, or places to stay
- weather_agent: weather, climate, season, forecast, or packing advice
- budget_agent: cost, affordability, price limits, or budget feasibility
- itinerary_agent: creates the integrated travel plan and must always be included

Return strict JSON only using this schema:
{{
        "selected_agents": ["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent"],
        "trip_constraints": {{
                "destination": "",
                "origin": "",
                "duration": "",
                "budget": "",
                "travel_style": "",
                "special_preferences": []
        }},
        "reasoning": ""
}}

User request:
{query}
"""
        try:
                supervisor_raw = _llm_text(
                        "You route work to travel specialist agents. Return strict JSON only.",
                        supervisor_prompt,
                )
                parsed = _json_from_llm(supervisor_raw)
                requested_agents = set(parsed.get("selected_agents", []) or [])
                requested_agents.add("itinerary_agent")
                requested_agents.add("weather_agent")
                selected_agents = [
                        name for name in AGENT_ORDER
                        if name in requested_agents and name in KNOWN_AGENTS
                ]

                constraints = _empty_constraints()
                parsed_constraints = parsed.get("trip_constraints", {})
                if isinstance(parsed_constraints, dict):
                        constraints.update(parsed_constraints)
                reasoning = str(parsed.get("reasoning", "")).strip()
                llm_calls += 1

        except Exception as exc:

                print(f"Supervisor fallback used: {exc}")
                # Original workflow behavior is preserved as the fallback.*

                selected_agents = AGENT_ORDER.copy()

                constraints = _empty_constraints()

                reasoning = (

                        "Supervisor parsing failed, so the original full travel workflow "

                        "was selected as a safe fallback."

                )
        return {

                "guardrail_allowed": True,

                "guardrail_reason": guardrail_reason,

                "selected_agents": selected_agents,

                "trip_constraints": constraints,

                "supervisor_reasoning": reasoning,

                "messages": [AIMessage(content="Supervisor created the agent plan.")],

                "llm_calls": llm_calls,

        }

def guardrail_blocked_agent(state: TravelState):
        reason = state.get("final_response") or state.get("guardrail_reason") or (

                "This request was blocked by the travel input guardrail."
        )
        return {
                "final_response": reason,
                "messages": [AIMessage(content=reason)],
        }


# Flight Tool Router Prompt*
FLIGHT_AGENT_PROMPT = """
You are a travel flight expert.
User Query:
{query}
Available airport information:
{airport_data}
Available airline information:
{airline_data}
Determine the most relevant information for this specific trip.
Return:
1. Departure airport
2. Arrival airport
3. Relevant airlines
4. Typical flight duration
5. Airfare information if available
6. Peak-season warning
7. Booking advice


Use only information relevant to the user's trip.
Do not list unrelated airports or airlines.
Be concise but complete.
"""


def _normalise(value: Any) -> str:
        return str(value or "").strip().lower()


def _find_relevant_records(
        data: Any,
        search_values: list[str],
) -> list[Any]:
        search_values = [
                _normalise(value)
                for value in search_values
                if value
        ]
        if not search_values:
                return []
        if isinstance(data, dict):

                # MCP responses sometimes wrap the actual list*
                # inside a key such as "data", "results", etc.*
                for key in ("data", "results", "airports", "items"):
                        if key in data:
                                return _find_relevant_records(
                                        data[key],
                                        search_values
                                )
                text = _normalise(json.dumps(data))
                if any(value in text for value in search_values):
                        return [data]
                return []
        if isinstance(data, list):
                matches = []
                for item in data:
                        text = _normalise(
                                json.dumps(item, ensure_ascii=False)
                                if isinstance(item, (dict, list))
                                else item
                        )
                        if any(
                                value in text
                                for value in search_values
                        ):
                                matches.append(item)
                return matches

        text = _normalise(data)
        if any(
                value in text
                for value in search_values
        ):
                return [data]
        return []


def _find_relevant_airlines(
        data: Any,
        airport_records: list[Any],
) -> list[Any]:


        # Extract airline identifiers/names from the*
        # relevant airport records when available.*
        airline_values = []
        for airport in airport_records:
                if isinstance(airport, dict):
                        for key in (
                                "airline",
                                "airline_name",
                                "airline_iata",
                                "airline_icao",
                                "carrier",
                                "carrier_name",
                        ):
                                value = airport.get(key)
                                if value:
                                        airline_values.append(
                                                str(value)
                                        )


        # If the airport data doesn't expose airline*
        # information, don't dump the entire airline DB.*
        if not airline_values:
                return []
        return _find_relevant_records(
                data,
                airline_values
        )



# Flight Agent

def flight_agent(state: TravelState):
        print("\nINSIDE FLIGHT AGENT\n")
        query = state["user_query"]
        constraints = state.get("trip_constraints", {})
        origin = constraints.get("origin", "")
        destination = constraints.get("destination", "")

        try:
                airports = asyncio.run(
                        aviation_mcp_call("list_airports")
                )
                airlines = asyncio.run(
                        aviation_mcp_call("list_airlines")
                )


                # Keep the MCP data as Python objects as long as possible.*
                # We filter it before sending anything to the LLM.*
                relevant_airports = _find_relevant_records(
                        airports,
                        [origin, destination]
                )
                relevant_airlines = _find_relevant_airlines(
                        airlines,
                        relevant_airports
                )
                prompt = FLIGHT_AGENT_PROMPT.format(
                        query=query,
                        airport_data=json.dumps(
                                relevant_airports,
                                ensure_ascii=False
                        ),
                        airline_data=json.dumps(
                                relevant_airlines,
                                ensure_ascii=False
                        ),
                )
                response = specialist_llm.invoke([
                        SystemMessage(
                                content=(
                                        "You are an expert travel flight planner. "
                                        "Use only information relevant to the requested route."
                                )
                        ),
                        HumanMessage(content=prompt),
                ])
                flight_data = response.content
        except Exception as exc:
                flight_data = (
                        f"Flight information unavailable: {exc}"
                )
        return {
                "flight_results": flight_data,
                "messages": [
                        AIMessage(
                                content="Flight recommendations generated"
                        )
                ],
                "llm_calls": state.get("llm_calls", 0) + 1,
        }



# hotel agent
def hotel_agent(state: TravelState):
        constraints = state.get("trip_constraints", {}) or {}
        destination = str(constraints.get("destination", "")).strip()
        travel_style = str(constraints.get("travel_style", "")).strip()
        budget = str(constraints.get("budget", "")).strip()

        if destination:
                search_query = f"Best hotels to stay in {destination}"
                if travel_style:
                        search_query += f" for {travel_style} travelers"
                if budget:
                        search_query += f" within {budget} budget"
                search_query += " with approximate nightly price, rating, neighborhood, and amenities"
        else:
                search_query = f"Best hotels and neighborhood stays for: {state['user_query']}"

        try:
                raw_hotels = asyncio.run(
                        tavily_mcp_search(search_query)
                )
                hotel_context = _limit_context(raw_hotels, 4000)
                prompt = f"""
Find useful hotel options for this trip:
{state["user_query"]}

Destination: {destination or "See user query"}
Search findings:
{hotel_context}

Return a clean Markdown summary covering:
- Hotel name & neighborhood
- Approximate nightly price range (clearly marked as approximate)
- Rating / guest review highlights if available
- Important amenities & suitability for the traveler's style
- Source links if available

Do not return unrelated hotels from the origin city or general filler articles.
"""
                response = specialist_llm.invoke([
                        SystemMessage(
                                content=(
                                        "You are a travel accommodation specialist. "
                                        "Summarize only relevant hotels in the destination city in clean Markdown."
                                )
                        ),
                        HumanMessage(content=prompt),
                ])
                hotel_results = str(response.content or "").strip() or _limit_context(raw_hotels, 3500)

        except Exception as exc:
                print(
                        f"HOTEL AGENT MCP ERROR: "
                        f"{type(exc).__name__}: {exc}",
                        flush=True,
                )

                hotel_results = (
                        "Live hotel search is temporarily unavailable. "
                        "Provide general accommodation and neighborhood "
                        "guidance based on the destination and clearly "
                        "label it as non-live advice."
                )
        return {
                "hotel_results": str(hotel_results),
                "messages": [
                        AIMessage(
                                content="Hotel information processed."
                        )
                ],
                "llm_calls": (
                        state.get("llm_calls", 0) + 1
                ),
        }


def _parse_maybe_json(data: Any) -> Any:
        if isinstance(data, str):
                text = data.strip()
                if text.startswith("{") or text.startswith("["):
                        try:
                                return json.loads(text)
                        except Exception:
                                return data
        return data


def _format_weather_markdown(city: str, weather_data: Any, forecast_data: Any) -> str:
        cur = _parse_maybe_json(weather_data)
        fc = _parse_maybe_json(forecast_data)

        lines: list[str] = []
        if isinstance(cur, dict) and ("temperature_c" in cur or "condition" in cur):
                resolved_city = cur.get("city") or city
                temp = cur.get("temperature_c")
                feels = cur.get("feels_like_c")
                humidity = cur.get("humidity")
                cond = str(cur.get("condition") or "").capitalize()
                wind = cur.get("wind_speed")
                lines.append(f"### Current Weather in {resolved_city}")
                if cond:
                        lines.append(f"- **Condition:** {cond}")
                if temp is not None:
                        feels_str = f" *(feels like {feels}°C)*" if feels is not None else ""
                        lines.append(f"- **Temperature:** {temp}°C{feels_str}")
                if humidity is not None:
                        lines.append(f"- **Humidity:** {humidity}%")
                if wind is not None:
                        lines.append(f"- **Wind Speed:** {wind} m/s")
        else:
                lines.append(f"### Current Weather in {city}")
                lines.append(str(weather_data).strip())

        if isinstance(fc, dict) and isinstance(fc.get("forecast"), list) and fc["forecast"]:
                lines.append("\n### Upcoming Forecast (3-Hour Intervals)")
                lines.append("| Date & Time | Temp (°C) | Condition |")
                lines.append("|---|---|---|")
                for slot in fc["forecast"]:
                        if not isinstance(slot, dict):
                                continue
                        dt = slot.get("datetime", "")
                        t_c = slot.get("temperature_c", "")
                        c_desc = str(slot.get("condition", "")).capitalize()
                        lines.append(f"| {dt} | {t_c}°C | {c_desc} |")
        elif forecast_data:
                lines.append("\n### Forecast")
                lines.append(str(forecast_data).strip())

        return "\n".join(lines).strip()


# weather agent
def weather_agent(state: TravelState):
        print("\nINSIDE WEATHER AGENT\n")
        city = (
                state.get("trip_constraints", {})
                .get("destination", "")
                .strip()
        )
        if not city:
                city = extract_destination(state["user_query"])

        clean_city = re.sub(r"\s*\(.*?\)\s*", "", city).split(",")[0].strip() or city

        try:
                weather_data = asyncio.run(
                        weather_mcp_search(clean_city)
                )
                forecast_data = asyncio.run(
                        forecast_mcp_search(clean_city)
                )
                weather_results = _format_weather_markdown(
                        clean_city,
                        weather_data,
                        forecast_data,
                )
        except Exception as exc:
                print(
                        f"WEATHER AGENT MCP ERROR: "
                        f"{type(exc).__name__}: {exc}",
                        flush=True,
                )
                weather_results = (
                        f"Live weather information for {city} "
                        "is temporarily unavailable. "
                        "Give general seasonal guidance and advise "
                        "the traveler to verify the forecast before departure."
                )
        return {
                "weather_results": weather_results,
                "messages": [
                        AIMessage(
                                content="Weather information processed."
                        )
                ],
        }




# budget agent
def budget_agent(state: TravelState):

        prompt = f"""

Analyze whether this trip is realistic for the user's budget.

User Query:
{state['user_query']}
Trip Constraints:
{json.dumps(
        state.get('trip_constraints', {}),
        ensure_ascii=False
)}

Flight Results:
{state.get('flight_results', '')}
Hotel Results:
{state.get('hotel_results', '')}


Return:
1. Estimated cost categories
2. Budget risk areas
3. Money-saving suggestions
4. Overall feasibility

If exact live prices are unavailable, clearly label estimates as approximate.

"""
        response = specialist_llm.invoke([

                SystemMessage(

                        content="You are a practical travel budget analyst."

                ),

                HumanMessage(content=prompt),

        ])

        return {

                "budget_results": response.content,

                "messages": [

                        AIMessage(

                                content="Budget assessment generated."

                        )

                ],

                "llm_calls": state.get("llm_calls", 0) + 1,

        }



def _split_days(itinerary: str) -> dict[str, str]:
    """Return complete Day sections keyed by day number."""
    return {
        match.group(1): match.group(0).strip()
        for match in DAY_PATTERN.finditer(itinerary)
    }


def _extract_day_sections(itinerary: str) -> dict[str, str]:
    """Backward-compatible alias for day-section extraction."""
    return _split_days(itinerary)


def _extract_day_numbers(text: str) -> list[str]:
    return re.findall(r"\bDay\s+(\d+)\b", text, flags=re.IGNORECASE)


def _merge_revised_days(
    original_itinerary: str,
    revised_sections: str,
) -> str:
    """Replace revised Day sections and append any newly added Day sections."""

    replacements = _split_days(revised_sections)

    if not replacements:
        return original_itinerary

    result = original_itinerary
    original_Matches = list(DAY_PATTERN.finditer(original_itinerary))
    existing_day_nums = {m.group(1) for m in original_Matches}

    for match in reversed(original_Matches):
        day_number = match.group(1)

        if day_number in replacements:
            result = (
                result[:match.start()]
                + replacements[day_number]
                + "\n\n"
                + result[match.end():]
            )

    new_day_nums = sorted(
        [d for d in replacements.keys() if d not in existing_day_nums],
        key=lambda x: int(x) if x.isdigit() else 999,
    )
    if new_day_nums:
        updated_matches = list(DAY_PATTERN.finditer(result))
        new_block = "\n\n".join(replacements[d] for d in new_day_nums)
        if updated_matches:
            last_end = updated_matches[-1].end()
            result = (
                result[:last_end].rstrip()
                + "\n\n"
                + new_block
                + "\n\n"
                + result[last_end:].lstrip()
            )
        else:
            result = result.rstrip() + "\n\n" + new_block

    return result.strip()


def _detect_requested_duration(feedback: str, current_day_count: int) -> int | None:
    """Detect if the user's revision feedback requests adding/removing days or a new total duration."""
    duration_match = re.search(
        r"\b(\d+)\s*(?:[-–—‑]\s*)?(?:day|days)\b",
        feedback,
        flags=re.IGNORECASE,
    )
    if duration_match:
        # Ignore references like "Day 2" (which has "Day" before the number, not after)
        requested = int(duration_match.group(1))
        if 1 <= requested <= MAX_TRIP_DAYS and requested != current_day_count:
            return requested

    if re.search(
        r"\b(?:add|include|plus|extend\s+by)\s+(?:another|one\s+more|an\s+extra|1\s+more|a|1|one)\s+day\b",
        feedback,
        flags=re.IGNORECASE,
    ):
        return min(MAX_TRIP_DAYS, max(1, current_day_count) + 1)

    if re.search(
        r"\b(?:remove|drop|cut|shorten\s+by)\s+(?:a|1|one|the\s+last)\s+day\b",
        feedback,
        flags=re.IGNORECASE,
    ) and current_day_count > 1:
        return current_day_count - 1

    return None


def _limit_context(text: Any, max_chars: int) -> str:
    """Bound specialist context sent to an LLM without changing graph state."""
    if not text:
        return ""

    if isinstance(text, (dict, list)):
        try:
            text = json.dumps(text, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            text = str(text)

    text = str(text).strip()

    if len(text) <= max_chars:
        return text

    return (
        text[:max_chars]
        + "\n\n[Additional specialist details omitted from LLM context.]"
    )


def _select_affected_days(
    feedback: str,
    day_sections: dict[str, str],
) -> list[str]:
    """Identify which existing itinerary days the feedback affects."""

    explicit_days = re.findall(
        r"\bDay\s+(\d+)\b",
        feedback,
        flags=re.IGNORECASE,
    )

    affected = [day for day in explicit_days if day in day_sections]

    if affected:
        return list(dict.fromkeys(affected))

    # Headings alone are insufficient for feedback such as
    # "add some devotional places". Give the small model a short
    # preview of each actual day.
    previews = []

    for day_number, section in day_sections.items():
        preview = "\n".join(section.splitlines()[:12]).strip()

        if len(preview) > 900:
            preview = preview[:900] + "..."

        previews.append(f"DAY {day_number}:\n{preview}")

    day_index = "\n\n".join(previews)

    prompt = f"""
Identify which itinerary day(s) should be modified.

USER FEEDBACK:
{feedback}

CURRENT DAY CONTENT:
{day_index}

Rules:
- Return ONLY day numbers separated by commas, for example: 2,3
- Return ALL only when the feedback genuinely applies across the trip.
- For feedback such as "add some devotional places", choose day(s)
  containing sightseeing/cultural activities where devotional places can
  naturally be added.
- Do not invent day numbers.
"""

    response = day_selector_llm.invoke([
        SystemMessage(
            content=(
                "You select affected itinerary days. "
                "Return only day numbers separated by commas, or ALL."
            )
        ),
        HumanMessage(content=prompt),
    ])

    selected = str(response.content).strip()

    if selected.upper() == "ALL":
        return list(day_sections.keys())

    found = re.findall(
        r"\b(?:Day\s*)?(\d+)\b",
        selected,
        flags=re.IGNORECASE,
    )

    affected = [day for day in found if day in day_sections]

    # Never regenerate the complete itinerary as a fallback.
    if not affected:
        affected = list(day_sections.keys())[:1]

    return list(dict.fromkeys(affected))


def itinerary_agent(state: TravelState):
    print("\nINSIDE ITINERARY AGENT\n")

    feedback = state.get("human_feedback", "").strip()
    existing_itinerary = state.get("itinerary", "").strip()
    day_sections = _split_days(existing_itinerary) if existing_itinerary else {}
    constraints = dict(state.get("trip_constraints") or _empty_constraints())
    selected_agents = list(state.get("selected_agents") or [])
    weather_results = str(state.get("weather_results") or "").strip()

    if not weather_results and constraints.get("destination"):
        try:
            w_out = weather_agent(state)
            weather_results = str(w_out.get("weather_results") or "").strip()
            if "weather_agent" not in selected_agents:
                selected_agents.append("weather_agent")
        except Exception as exc:
            print(f"Weather backfill skipped: {exc}", flush=True)

    requested_days = (
        _detect_requested_duration(feedback, len(day_sections))
        if feedback and day_sections
        else None
    )

    # REVISION MODE: Duration change (adding/removing days)
    if feedback and day_sections and requested_days is not None:
        constraints["duration"] = f"{requested_days} days"
        duration_revision_prompt = f"""
Update this travel itinerary to be EXACTLY {requested_days} days and apply the user's feedback.

USER FEEDBACK:
{feedback}

CURRENT ITINERARY:
{_limit_context(existing_itinerary, 5500)}

TRIP CONSTRAINTS:
{json.dumps(constraints, ensure_ascii=False, separators=(",", ":"))}

RULES:
- The revised itinerary MUST have EXACTLY {requested_days} days (### Day 1 through ### Day {requested_days}).
- Preserve existing well-planned activities where appropriate, move departure/airport transfer to Day {requested_days}, and add complete activities for any new day(s).
- Explicitly incorporate the user's feedback (e.g., specific devotional/religious places, sightseeing, or pacing changes).
- Use ASCII hyphens (-) or en-dashes (–) in headings: `### Day N – [Title]`.
- Keep the summary/practical tips section after the final day.

FORMAT FOR EACH DAY:
### Day N – [Title]

| Time | Activity | Approx. Cost (₹) |
|---|---|---:|
| ... | ... | ... |

Day N total: ≈ ₹X
"""
        response = itinerary_llm.invoke([
            SystemMessage(
                content=(
                    "You are an expert travel itinerary revision specialist. "
                    f"Produce the complete updated {requested_days}-day itinerary in clean Markdown."
                )
            ),
            HumanMessage(content=duration_revision_prompt),
        ])
        revised_full = str(response.content).strip()
        complete_itinerary = revised_full if _split_days(revised_full) else _merge_revised_days(existing_itinerary, revised_full)

    # REVISION MODE: Same duration, modify affected day(s)
    elif feedback and day_sections:
        affected_days = _select_affected_days(feedback, day_sections)

        affected_content = "\n\n".join(
            day_sections[day] for day in affected_days
        )

        revision_prompt = f"""
Revise ONLY the affected itinerary day(s).

USER FEEDBACK:
{feedback}

AFFECTED DAY(S):
{affected_content}

REQUIREMENTS:
- The user's feedback is a REQUIRED change.
- Modify only the affected day(s): {", ".join(f"Day {d}" for d in affected_days)}.
- Preserve useful existing activities unless the feedback requires a change.
- Add the requested places or activities explicitly.
- If devotional/religious places are requested, include specific suitable
  devotional/religious places for the destination.
- Keep the same trip duration.
- Adjust timings so the new activity fits naturally.
- Update affected costs.
- Keep each replacement day complete.
- Do not modify unrelated days.
- Return ONLY the complete replacement Day section(s).
- Use exact heading format: `### Day N – [Title]`

FORMAT:
### Day N – [Title]

| Time | Activity | Approx. Cost (₹) |
|---|---|---:|
| ... | ... | ... |

Day N total: ≈ ₹X
"""

        response = revision_llm.invoke([
            SystemMessage(
                content=(
                    "You are a travel itinerary revision specialist. "
                    "Apply the user's feedback concretely. "
                    "Return only the complete replacement Day section(s) using `### Day N – Title` headings."
                )
            ),
            HumanMessage(content=revision_prompt),
        ])

        revised_sections = str(response.content).strip()

        complete_itinerary = _merge_revised_days(
            existing_itinerary,
            revised_sections,
        )
    # INITIAL DRAFT MODE
    else:
        prompt = f"""
Create a COMPLETE travel itinerary.

USER:
{state["user_query"]}

TRIP CONSTRAINTS:
{json.dumps(
    constraints,
    ensure_ascii=False,
    separators=(",", ":"),
)}

FLIGHTS:
{_limit_context(state.get("flight_results", ""), 2800)}

HOTELS:
{_limit_context(state.get("hotel_results", ""), 3500)}

WEATHER:
{_limit_context(weather_results, 1800)}

BUDGET:
{_limit_context(state.get("budget_results", ""), 2200)}

RULES:
- Determine the exact trip duration from the user request and constraints.
- Generate exactly that many itinerary days.
- Cover EVERY day, including arrival and departure.
- Never omit a day.
- Use ONE practical itinerary.
- Keep relevant flight, hotel, sightseeing, meal, transport, weather and
  budget information.
- Clearly mark approximate prices.
- Every day must contain actual activities.
- Never stop after a heading or table header.
- Do not invent live prices or availability.
- Keep the output compact enough to finish, but COMPLETE.
- After the final day include:
  * Total estimated trip cost
  * Practical tips
  * Important travel considerations

FORMAT:

### Day N – [Title]

| Time | Activity | Approx. Cost (₹) |
|---|---|---:|
| ... | ... | ... |

Day N total: ≈ ₹X

Create the complete draft for human review.
"""

        response = itinerary_llm.invoke([
            SystemMessage(
                content=(
                    "You are an expert travel itinerary planner. "
                    "Produce a complete, practical itinerary and finish "
                    "every requested day."
                )
            ),
            HumanMessage(content=prompt),
        ])

        complete_itinerary = str(response.content).strip()

    approval_request = (
        "Please review the generated itinerary. "
        "Approve it if you are satisfied, or provide feedback "
        "for another revision."
    )
    print("ITINERARY AGENT FINISHED - RETURNING TO HITL", flush=True)
    return {
        "itinerary": complete_itinerary,
        "trip_constraints": constraints,
        "weather_results": weather_results,
        "selected_agents": selected_agents,
        "approval_request": approval_request,
        "approved": False,
        "messages": [
            AIMessage(
                content="Travel itinerary draft created for human review."
            )
        ],
        "llm_calls": state.get("llm_calls", 0) + 1,
    }


def human_approval_agent(state: TravelState):

        # Do not wrap interrupt() in try/except. LangGraph uses it to pause execution.*

        review = interrupt(

                {

                        "question": "Do you approve this itinerary?",

                        "draft_itinerary": state.get("itinerary", ""),

                        "approval_request": state.get("approval_request", ""),

                        "selected_agents": state.get("selected_agents", []),

                        "supervisor_reasoning": state.get("supervisor_reasoning", ""),

                        "expected_response": {

                                "approved": True,

                                "feedback": "Optional revision feedback",

                        },

                }

        )



        approved = bool(review.get("approved", False))
        human_feedback = str(review.get("feedback", "")).strip()
        print("HITL REVIEW:", review, flush=True)
        print("HITL APPROVED:", approved, flush=True)
        print("HITL FEEDBACK:", human_feedback, flush=True)



        return {

                "approved": approved,

                "human_feedback": human_feedback,

                "messages": [AIMessage(content="Human approval step completed.")],

        }







def final_agent(state: TravelState):



        print("\nINSIDE FINAL AGENT\n")



        itinerary = state.get("itinerary", "").strip()



        return {

                "final_response": itinerary,

                "messages": [

                        AIMessage(

                                content="Final travel plan generated."

                        )

                ],

                "llm_calls": state.get("llm_calls", 0),

        }



# supervisor routing*

ROUTE_MAP = {

        "guardrail_blocked": "guardrail_blocked",

        "flight_agent": "flight_agent",

        "hotel_agent": "hotel_agent",

        "weather_agent": "weather_agent",

        "budget_agent": "budget_agent",

        "itinerary_agent": "itinerary_agent",

}





def _selected_agents(state: TravelState) -> list[str]:

        selected = state.get("selected_agents", [])

        return [agent for agent in AGENT_ORDER if agent in selected]





def route_from_supervisor(state: TravelState) -> str:

        if not state.get("guardrail_allowed", True):

                return "guardrail_blocked"



        selected = _selected_agents(state)

        return selected[0] if selected else "itinerary_agent"



# upgrading the agents in order one after another*

def route_after_agent(current_agent: str):

        def route(state: TravelState) -> str:

                selected = _selected_agents(state)

                current_index = AGENT_ORDER.index(current_agent)



                for next_agent in AGENT_ORDER[current_index + 1 :]:

                        if next_agent in selected:

                                return next_agent



                return "itinerary_agent"



        return route



def route_after_human_approval(state: TravelState) -> str:

        if state.get("approved", False):

                return "final_agent"



        return "itinerary_agent"







# graph*

graph = StateGraph(TravelState)



graph.add_node("supervisor", supervisor_agent)

graph.add_node("guardrail_blocked", guardrail_blocked_agent)

graph.add_node("flight_agent", flight_agent)

graph.add_node("hotel_agent", hotel_agent)

graph.add_node("weather_agent", weather_agent)

graph.add_node("budget_agent", budget_agent)

graph.add_node("itinerary_agent", itinerary_agent)
graph.add_node("human_approval", human_approval_agent)
graph.add_node("final_agent", final_agent)

graph.add_edge(START, "supervisor")

graph.add_conditional_edges("supervisor", route_from_supervisor, ROUTE_MAP)

graph.add_conditional_edges(
    "flight_agent",
    route_after_agent("flight_agent"),
    ROUTE_MAP
)

graph.add_conditional_edges(
    "hotel_agent",
    route_after_agent("hotel_agent"),
    ROUTE_MAP
)

graph.add_conditional_edges(
    "weather_agent",
    route_after_agent("weather_agent"),
    ROUTE_MAP
)

graph.add_conditional_edges(
    "budget_agent",
    route_after_agent("budget_agent"),
    ROUTE_MAP
)

graph.add_edge("itinerary_agent", "human_approval")

graph.add_conditional_edges(
    "human_approval",
    route_after_human_approval,
    {
        "itinerary_agent": "itinerary_agent",
        "final_agent": "final_agent",
    },
)

graph.add_edge("final_agent", END)
graph.add_edge("guardrail_blocked", END)



# db connection*

DATABASE_URL = get_database_url()



_conn = psycopg.connect(

        DATABASE_URL,

        autocommit=True,

        row_factory=dict_row

)



checkpointer = PostgresSaver(_conn)

checkpointer.setup()



travel_graph = graph.compile(checkpointer=checkpointer)



# fast api using*

def _interrupt_payload(result: dict[str, Any]) -> dict[str, Any] | None:

        interrupts = result.get("__interrupt__", [])

        if not interrupts:

                return None



        first_interrupt = interrupts[0]

        payload = getattr(first_interrupt, "value", first_interrupt)

        return payload if isinstance(payload, dict) else {"value": payload}





def _format_search_results_markdown(data: dict[str, Any]) -> str:
        results = data.get("results")
        if not isinstance(results, list) or not results:
                return json.dumps(data, ensure_ascii=False, indent=2)
        lines: list[str] = ["### Recommended Stays & Sources\n"]
        for item in results:
                if not isinstance(item, dict):
                        continue
                title = str(item.get("title") or "Hotel option").strip()
                url = str(item.get("url") or "").strip()
                content = str(item.get("content") or "").strip()
                if url:
                        lines.append(f"- **[{title}]({url})**")
                else:
                        lines.append(f"- **{title}**")
                if content:
                        snippet = content[:500].strip()
                        lines.append(f"  {snippet}")
        return "\n\n".join(lines).strip()


def _coerce_text(value: Any) -> str:
        if value is None:
                return ""
        if isinstance(value, list):
                parts: list[str] = []
                for item in value:
                        if isinstance(item, dict) and "text" in item:
                                parts.append(_coerce_text(item["text"]))
                        else:
                                parts.append(_coerce_text(item))
                return "\n\n".join(p for p in parts if p).strip()
        if isinstance(value, dict):
                if "results" in value and isinstance(value.get("results"), list):
                        return _format_search_results_markdown(value)
                if "text" in value and len(value) <= 2:
                        return _coerce_text(value["text"])
                return json.dumps(value, ensure_ascii=False, indent=2)
        text = str(value).strip()
        if text.startswith("{") and '"results"' in text:
                try:
                        parsed = json.loads(text)
                        if isinstance(parsed, dict) and isinstance(parsed.get("results"), list):
                                return _format_search_results_markdown(parsed)
                except Exception:
                        pass
        return text


def _normalize_constraints(raw: Any) -> dict[str, Any]:
        base = _empty_constraints()
        if not isinstance(raw, dict):
                return base
        prefs = raw.get("special_preferences")
        if isinstance(prefs, list):
                norm_prefs = [str(p).strip() for p in prefs if p is not None and str(p).strip()]
        elif isinstance(prefs, str) and prefs.strip():
                norm_prefs = [prefs.strip()]
        else:
                norm_prefs = []
        return {
                "destination": _coerce_text(raw.get("destination", "")),
                "origin": _coerce_text(raw.get("origin", "")),
                "duration": _coerce_text(raw.get("duration", "")),
                "budget": _coerce_text(raw.get("budget", "")),
                "travel_style": _coerce_text(raw.get("travel_style", "")),
                "special_preferences": norm_prefs,
        }


def _serialize_result(

        result: dict[str, Any],

        thread_id: str,

) -> dict[str, Any]:

        messages = result.get("messages", [])

        last_message = _coerce_text(messages[-1].content) if messages else ""

        answer = _coerce_text(result.get("final_response")) or last_message

        interrupt_payload = _interrupt_payload(result)



        if interrupt_payload:

                answer = _coerce_text(interrupt_payload.get("draft_itinerary")) or _coerce_text(
                        result.get("itinerary", "")
                )



        return {

                "thread_id": str(thread_id),

                "answer": answer,

                "requires_approval": interrupt_payload is not None,

                "approval_request": _coerce_text(

                        interrupt_payload.get("approval_request", "")

                        if interrupt_payload

                        else result.get("approval_request", "")

                ),

                "flight_results": _coerce_text(result.get("flight_results", "")),

                "hotel_results": _coerce_text(result.get("hotel_results", "")),

                "weather_results": _coerce_text(result.get("weather_results", "")),

                "budget_results": _coerce_text(result.get("budget_results", "")),

                "itinerary": _coerce_text(

                        interrupt_payload.get("draft_itinerary", "")

                        if interrupt_payload

                        else result.get("itinerary", "")

                ),

                "selected_agents": [
                        str(a) for a in (result.get("selected_agents") or []) if a
                ],

                "trip_constraints": _normalize_constraints(result.get("trip_constraints", {})),

                "supervisor_reasoning": _coerce_text(result.get("supervisor_reasoning", "")),

                "guardrail_allowed": bool(result.get("guardrail_allowed", True)),

                "guardrail_reason": _coerce_text(result.get("guardrail_reason", "")),

                "approved": bool(result.get("approved")) if result.get("approved") is not None else False,

                "human_feedback": _coerce_text(result.get("human_feedback", "")),

                "llm_calls": int(result.get("llm_calls") or 0),

        }





def run_travel_agent(user_input: str, thread_id: str | None = None):

        """Start a new travel-planning run and pause at human approval."""

        if not thread_id:

                thread_id = f"user_{uuid.uuid4().hex}"



        config = {"configurable": {"thread_id": thread_id}}



        result = travel_graph.invoke(

                {

                        "messages": [HumanMessage(content=user_input)],

                        "user_query": user_input,

                        "guardrail_allowed": True,

                        "guardrail_reason": "",

                        "selected_agents": [],

                        "trip_constraints": _empty_constraints(),

                        "supervisor_reasoning": "",

                        "flight_results": "",

                        "hotel_results": "",

                        "weather_results": "",

                        "budget_results": "",

                        "itinerary": "",

                        "approval_request": "",

                        "approved": False,

                        "human_feedback": "",

                        "final_response": "",

                        "llm_calls": 0,

                },

                config=config,

        )



        return _serialize_result(result, thread_id)





def resume_travel_agent(
    thread_id: str,
    approved: bool,
    feedback: str = "",
):
    """Resume the paused LangGraph thread after human review."""

    if not thread_id:
        raise ValueError("thread_id is required to resume a travel plan.")

    config = {"configurable": {"thread_id": thread_id}}

    print("RESUME INPUT:", {
        "approved": approved,
        "feedback": feedback.strip()
    }, flush=True)

    with _DB_LOCK:
        result = travel_graph.invoke(
            Command(
                resume={
                    "approved": approved,
                    "feedback": feedback.strip(),
                }
            ),
            config=config,
        )

    serialized = _serialize_result(result, thread_id)
    with _SESSIONS_LOCK:
        existing = _SESSIONS.get(thread_id)
        if existing:
            existing["payload"] = serialized
            existing["trip_constraints"] = serialized.get("trip_constraints") or existing["trip_constraints"]
            existing["status"] = (
                "awaiting_approval" if serialized.get("requires_approval") else "approved"
            )
            existing["done"] = True

    return serialized


# ---------------------------------------------------------------------------
# Phase 5: Non-blocking execution, Snapshot & SSE Event Stream
# ---------------------------------------------------------------------------
import threading
import time
import traceback

_DB_LOCK = threading.RLock()
_SESSIONS_LOCK = threading.RLock()
_SESSIONS: dict[str, dict[str, Any]] = {}

_AGENT_TOOLS = {
    "supervisor": "route_agents",
    "flight_agent": "aviationstack.flights",
    "hotel_agent": "tavily.search",
    "weather_agent": "openweather.forecast",
    "budget_agent": "budget.feasibility",
    "itinerary_agent": "synthesize_itinerary",
}

_AGENT_RUNNING_MESSAGES = {
    "supervisor": "Checking request and routing specialist agents…",
    "flight_agent": "Searching airports and airlines for your route…",
    "hotel_agent": "Searching stays, neighborhoods and ratings…",
    "weather_agent": "Checking current conditions and forecast…",
    "budget_agent": "Estimating costs, risks and ways to save…",
    "itinerary_agent": "Synthesizing day-by-day plan with times and costs…",
}

_AGENT_DONE_MESSAGES = {
    "supervisor": "Routed request to specialist agents.",
    "flight_agent": "Airports and airline options analyzed.",
    "hotel_agent": "Hotel options and neighborhood stays gathered.",
    "weather_agent": "Current weather and forecast checked.",
    "budget_agent": "Budget breakdown and feasibility complete.",
    "itinerary_agent": "Draft itinerary ready for your review.",
}


def _format_trace_ts(seconds: float) -> str:
    total = max(0, int(seconds))
    return f"{total // 60:02d}:{total % 60:02d}"


def _append_step_event(
    session: dict[str, Any],
    agent: str,
    status: str,
    tool: str,
    message: str,
) -> None:
    elapsed = round(max(0.1, time.monotonic() - session["started_at"]), 1)
    session["elapsed"] = elapsed
    session["steps"][agent] = status

    short_agent = agent.replace("_agent", "")
    for trace in session["traces"]:
        trace["active"] = False

    session["traces"].append(
        {
            "id": f"{agent}-{tool}-{len(session['traces'])}",
            "time": _format_trace_ts(elapsed),
            "agent": short_agent,
            "tool": tool,
            "status": "done" if status == "done" else ("failed" if status == "failed" else ""),
            "active": status == "running",
        }
    )

    session["events"].append(
        {
            "type": "step",
            "agent": agent,
            "status": status,
            "tool": tool,
            "message": message,
            "t": elapsed,
        }
    )


def _next_selected_agent(selected_agents: list[str], current_agent: str | None) -> str | None:
    ordered = [a for a in AGENT_ORDER if a in selected_agents]
    if not ordered:
        ordered = ["itinerary_agent"]
    if current_agent is None:
        return ordered[0]
    if current_agent in ordered:
        idx = ordered.index(current_agent)
        if idx + 1 < len(ordered):
            return ordered[idx + 1]
    return None


def _execute_initial_stream_worker(thread_id: str, user_input: str) -> None:
    session = _SESSIONS.get(thread_id)
    if not session:
        return

    config = {"configurable": {"thread_id": thread_id}}
    initial_state: TravelState = {
        "messages": [HumanMessage(content=user_input)],
        "user_query": user_input,
        "guardrail_allowed": True,
        "guardrail_reason": "",
        "selected_agents": [],
        "trip_constraints": _empty_constraints(),
        "supervisor_reasoning": "",
        "flight_results": "",
        "hotel_results": "",
        "weather_results": "",
        "budget_results": "",
        "itinerary": "",
        "approval_request": "",
        "approved": False,
        "human_feedback": "",
        "final_response": "",
        "llm_calls": 0,
    }

    try:
        with _SESSIONS_LOCK:
            _append_step_event(
                session,
                agent="supervisor",
                status="running",
                tool="guardrail_check",
                message=_AGENT_RUNNING_MESSAGES["supervisor"],
            )

        accumulated: dict[str, Any] = dict(initial_state)
        selected_agents: list[str] = []

        with _DB_LOCK:
            for chunk in travel_graph.stream(
                initial_state,
                config=config,
                stream_mode="updates",
            ):
                if not isinstance(chunk, dict):
                    continue

                for node_name, node_update in chunk.items():
                    if node_name == "__interrupt__":
                        accumulated["__interrupt__"] = node_update
                        continue

                    if isinstance(node_update, dict):
                        accumulated.update(node_update)

                    with _SESSIONS_LOCK:
                        if node_name == "supervisor":
                            allowed = bool(accumulated.get("guardrail_allowed", True))
                            reason = str(accumulated.get("guardrail_reason", ""))
                            constraints = accumulated.get("trip_constraints") or _empty_constraints()
                            selected_agents = list(accumulated.get("selected_agents") or [])

                            session["trip_constraints"] = constraints
                            session["events"].append(
                                {
                                    "type": "guardrail",
                                    "allowed": allowed,
                                    "reason": reason,
                                }
                            )

                            if allowed:
                                session["events"].append(
                                    {
                                        "type": "constraints",
                                        "data": constraints,
                                    }
                                )
                                _append_step_event(
                                    session,
                                    agent="supervisor",
                                    status="done",
                                    tool="route_agents",
                                    message=f"Routed to {len(selected_agents) or 5} specialist agents.",
                                )
                                for candidate in AGENT_ORDER:
                                    if selected_agents and candidate not in selected_agents:
                                        session["steps"][candidate] = "skipped"
                                        session["events"].append(
                                            {
                                                "type": "step",
                                                "agent": candidate,
                                                "status": "skipped",
                                                "tool": "skip",
                                                "message": "Skipped for this trip",
                                                "t": round(
                                                    max(0.1, time.monotonic() - session["started_at"]),
                                                    1,
                                                ),
                                            }
                                        )
                                first_agent = _next_selected_agent(selected_agents, None)
                                if first_agent:
                                    _append_step_event(
                                        session,
                                        agent=first_agent,
                                        status="running",
                                        tool=_AGENT_TOOLS.get(first_agent, first_agent),
                                        message=_AGENT_RUNNING_MESSAGES.get(first_agent, "Working…"),
                                    )
                            else:
                                _append_step_event(
                                    session,
                                    agent="supervisor",
                                    status="done",
                                    tool="guardrail_check",
                                    message=reason or "Request blocked by travel guardrail.",
                                )

                        elif node_name in KNOWN_AGENTS:
                            _append_step_event(
                                session,
                                agent=node_name,
                                status="done",
                                tool=_AGENT_TOOLS.get(node_name, node_name),
                                message=_AGENT_DONE_MESSAGES.get(node_name, "Done"),
                            )
                            next_agent = _next_selected_agent(selected_agents, node_name)
                            if next_agent:
                                _append_step_event(
                                    session,
                                    agent=next_agent,
                                    status="running",
                                    tool=_AGENT_TOOLS.get(next_agent, next_agent),
                                    message=_AGENT_RUNNING_MESSAGES.get(next_agent, "Working…"),
                                )

        serialized = _serialize_result(accumulated, thread_id)
        with _SESSIONS_LOCK:
            for trace in session["traces"]:
                trace["active"] = False
            session["payload"] = serialized
            session["trip_constraints"] = serialized.get("trip_constraints") or session["trip_constraints"]
            session["elapsed"] = round(max(0.1, time.monotonic() - session["started_at"]), 1)

            if not serialized.get("guardrail_allowed", True):
                session["status"] = "blocked"
            elif serialized.get("requires_approval"):
                session["status"] = "awaiting_approval"
            else:
                session["status"] = "approved"

            session["events"].append(
                {
                    "type": "final",
                    "payload": serialized,
                }
            )
            session["done"] = True

    except Exception as exc:
        traceback.print_exc()
        with _SESSIONS_LOCK:
            for trace in session["traces"]:
                trace["active"] = False
            session["status"] = "error"
            session["error"] = str(exc)
            session["events"].append(
                {
                    "type": "error",
                    "message": str(exc),
                }
            )
            session["done"] = True


def _execute_revision_stream_worker(thread_id: str, feedback: str) -> None:
    session = _SESSIONS.get(thread_id)
    if not session:
        return

    config = {"configurable": {"thread_id": thread_id}}
    try:
        with _SESSIONS_LOCK:
            _append_step_event(
                session,
                agent="itinerary_agent",
                status="running",
                tool="revise_days",
                message="Rewriting affected itinerary day sections…",
            )

        with _DB_LOCK:
            result = travel_graph.invoke(
                Command(
                    resume={
                        "approved": False,
                        "feedback": feedback.strip(),
                    }
                ),
                config=config,
            )

        serialized = _serialize_result(result, thread_id)
        with _SESSIONS_LOCK:
            _append_step_event(
                session,
                agent="itinerary_agent",
                status="done",
                tool="revise_days",
                message="Updated itinerary ready for review.",
            )
            for trace in session["traces"]:
                trace["active"] = False
            session["payload"] = serialized
            session["trip_constraints"] = serialized.get("trip_constraints") or session["trip_constraints"]
            session["status"] = (
                "awaiting_approval" if serialized.get("requires_approval") else "approved"
            )
            session["events"].append(
                {
                    "type": "final",
                    "payload": serialized,
                }
            )
            session["done"] = True

    except Exception as exc:
        traceback.print_exc()
        with _SESSIONS_LOCK:
            for trace in session["traces"]:
                trace["active"] = False
            session["status"] = "error"
            session["error"] = str(exc)
            session["events"].append(
                {
                    "type": "error",
                    "message": str(exc),
                }
            )
            session["done"] = True


def start_travel_agent_stream(
    user_input: str,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """Start a new trip run in a background worker thread and return thread_id immediately."""
    if not thread_id:
        thread_id = f"user_{uuid.uuid4().hex}"

    with _SESSIONS_LOCK:
        _SESSIONS[thread_id] = {
            "thread_id": thread_id,
            "user_query": user_input,
            "status": "streaming",
            "started_at": time.monotonic(),
            "elapsed": 0.0,
            "steps": {
                "supervisor": "running",
                "flight_agent": "queued",
                "hotel_agent": "queued",
                "weather_agent": "queued",
                "budget_agent": "queued",
                "itinerary_agent": "queued",
            },
            "traces": [],
            "trip_constraints": _empty_constraints(),
            "payload": None,
            "error": "",
            "events": [],
            "done": False,
        }

    worker = threading.Thread(
        target=_execute_initial_stream_worker,
        args=(thread_id, user_input),
        daemon=True,
    )
    worker.start()

    return {
        "thread_id": thread_id,
        "status": "streaming",
    }


def start_resume_travel_agent_stream(
    thread_id: str,
    approved: bool,
    feedback: str = "",
) -> dict[str, Any]:
    """Approve a trip synchronously or start a revision stream in the background."""
    if approved:
        serialized = resume_travel_agent(
            thread_id=thread_id,
            approved=True,
            feedback="",
        )
        with _SESSIONS_LOCK:
            existing = _SESSIONS.get(thread_id)
            if existing:
                existing["status"] = "approved"
                existing["payload"] = serialized
                existing["done"] = True
        return serialized

    with _SESSIONS_LOCK:
        session = _SESSIONS.get(thread_id)
        if not session:
            session = {
                "thread_id": thread_id,
                "user_query": "",
                "status": "revising",
                "started_at": time.monotonic(),
                "elapsed": 0.0,
                "steps": {
                    "supervisor": "done",
                    "flight_agent": "done",
                    "hotel_agent": "done",
                    "weather_agent": "done",
                    "budget_agent": "done",
                    "itinerary_agent": "running",
                },
                "traces": [],
                "trip_constraints": _empty_constraints(),
                "payload": None,
                "error": "",
                "events": [],
                "done": False,
            }
            _SESSIONS[thread_id] = session
        else:
            session["status"] = "revising"
            session["started_at"] = time.monotonic()
            session["steps"]["itinerary_agent"] = "running"
            session["error"] = ""
            session["events"] = []
            session["done"] = False

    worker = threading.Thread(
        target=_execute_revision_stream_worker,
        args=(thread_id, feedback),
        daemon=True,
    )
    worker.start()

    return {
        "thread_id": thread_id,
        "status": "revising",
    }


def get_trip_snapshot(thread_id: str) -> dict[str, Any] | None:
    """Return the current trip snapshot from memory or Postgres checkpointer."""
    with _SESSIONS_LOCK:
        session = _SESSIONS.get(thread_id)
        if session:
            elapsed = (
                round(max(0.1, time.monotonic() - session["started_at"]), 1)
                if not session["done"]
                else session["elapsed"]
            )
            return {
                "thread_id": thread_id,
                "status": session["status"],
                "user_query": session.get("user_query", ""),
                "trip_constraints": session.get("trip_constraints") or _empty_constraints(),
                "payload": session.get("payload"),
                "error": session.get("error", ""),
                "elapsed": elapsed,
                "steps": dict(session.get("steps", {})),
                "traces": list(session.get("traces", [])),
            }

    config = {"configurable": {"thread_id": thread_id}}
    try:
        with _DB_LOCK:
            snapshot = travel_graph.get_state(config)
    except Exception:
        return None

    if not snapshot or not getattr(snapshot, "values", None):
        return None

    values = dict(snapshot.values)
    tasks = getattr(snapshot, "tasks", ()) or ()
    has_interrupt = False
    for task in tasks:
        task_interrupts = getattr(task, "interrupts", ()) or ()
        if task_interrupts:
            values["__interrupt__"] = list(task_interrupts)
            has_interrupt = True
            break

    serialized = _serialize_result(values, thread_id)
    dest = (serialized.get("trip_constraints") or {}).get("destination", "").strip()
    if (
        serialized.get("guardrail_allowed", True)
        and dest
        and not (serialized.get("weather_results") or "").strip()
    ):
        try:
            w_out = weather_agent(values)
            w_text = _coerce_text(w_out.get("weather_results", ""))
            if w_text:
                serialized["weather_results"] = w_text
                if "weather_agent" not in serialized["selected_agents"]:
                    serialized["selected_agents"].append("weather_agent")
        except Exception as exc:
            print(f"Snapshot weather backfill skipped: {exc}", flush=True)

    if not serialized.get("guardrail_allowed", True):
        status = "blocked"
    elif has_interrupt or serialized.get("requires_approval"):
        status = "awaiting_approval"
    else:
        status = "approved"

    selected = set(serialized.get("selected_agents") or [])
    steps = {
        "supervisor": "done",
        "flight_agent": "done" if (not selected or "flight_agent" in selected) else "skipped",
        "hotel_agent": "done" if (not selected or "hotel_agent" in selected) else "skipped",
        "weather_agent": "done" if (not selected or "weather_agent" in selected) else "skipped",
        "budget_agent": "done" if (not selected or "budget_agent" in selected) else "skipped",
        "itinerary_agent": "done" if status != "blocked" else "skipped",
    }

    snapshot_data = {
        "thread_id": thread_id,
        "status": status,
        "user_query": str(values.get("user_query", "")),
        "trip_constraints": serialized.get("trip_constraints") or _empty_constraints(),
        "payload": serialized,
        "error": "",
        "elapsed": 0,
        "steps": steps,
        "traces": [],
    }
    with _SESSIONS_LOCK:
        if thread_id not in _SESSIONS:
            _SESSIONS[thread_id] = {
                **snapshot_data,
                "started_at": time.monotonic(),
                "events": [{"type": "final", "payload": serialized}],
                "done": True,
            }
    return snapshot_data


async def subscribe_trip_events(thread_id: str):
    """Async generator yielding Server-Sent Events (SSE) for a trip run."""
    cursor = 0
    while True:
        with _SESSIONS_LOCK:
            session = _SESSIONS.get(thread_id)
            if session is not None:
                pending = session["events"][cursor:]
                cursor += len(pending)
                is_done = bool(session["done"])
            else:
                pending = []
                is_done = True

        if session is None:
            snapshot = get_trip_snapshot(thread_id)
            if snapshot and snapshot.get("payload"):
                yield f"data: {json.dumps({'type': 'final', 'payload': snapshot['payload']}, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Trip session not found.'})}\n\n"
            break

        for evt in pending:
            yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

        if is_done:
            break

        await asyncio.sleep(0.15)