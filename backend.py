import os
import certifi
from dotenv import load_dotenv
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
    max_tokens=1600,
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
    r"(?ms)^###\s*Day\s+(\d+)\s*[-–—:]\s*.*?(?=^###\s*Day\s+\d+\s*[-–—:]|\Z)"
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
                requested_agents = parsed.get("selected_agents", [])
                selected_agents = [
                        name for name in AGENT_ORDER
                        if name in requested_agents and name in KNOWN_AGENTS
                ]

                # The itinerary agent integrates whichever specialist results were selected.*
                if "itinerary_agent" not in selected_agents:
                        selected_agents.append("itinerary_agent")

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
        query = f"""
Find useful hotel options for this trip:
{state["user_query"]}
Return information relevant to:
- hotel name
- location
- approximate price
- rating/review information if available
- important amenities
- suitability for the user's travel style
- source information

Do not return unrelated hotels or general travel articles.
"""
        try:
                hotel_results = asyncio.run(
                        tavily_mcp_search(query)
                )

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
                "hotel_results": hotel_results,
                "messages": [
                        AIMessage(
                                content="Hotel information processed."
                        )
                ],
                "llm_calls": (
                        state.get("llm_calls", 0) + 1
                ),
        }


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

        try:

                weather_data = asyncio.run(

                        weather_mcp_search(city)

                )

                forecast_data = asyncio.run(

                        forecast_mcp_search(city)

                )

                weather_results = f"""
Current Weather:
{weather_data}
Forecast:
{forecast_data}
"""
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
    """Replace only revised Day sections; keep all other content unchanged."""

    replacements = _split_days(revised_sections)

    if not replacements:
        return original_itinerary

    result = original_itinerary

    for match in reversed(list(DAY_PATTERN.finditer(original_itinerary))):
        day_number = match.group(1)

        if day_number in replacements:
            result = (
                result[:match.start()]
                + replacements[day_number]
                + "\n\n"
                + result[match.end():]
            )

    return result.strip()


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

    # REVISION MODE
    if feedback and day_sections:
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
- Modify only the affected day(s).
- Preserve useful existing activities unless the feedback requires a change.
- Add the requested places or activities explicitly.
- If devotional/religious places are requested, include specific suitable
  devotional/religious places for the destination.
- Keep the same trip duration.
- Adjust timings so the new activity fits naturally.
- Update affected costs.
- Keep each replacement day complete.
- Do not modify unrelated days.
- Do not generate any other days.
- Return ONLY the complete replacement Day section(s).

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
                    "Return only the complete replacement Day section(s). "
                    "Never regenerate the complete itinerary."
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
        constraints = state.get("trip_constraints", {})

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
{_limit_context(state.get("weather_results", ""), 1800)}

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

    return {
        "itinerary": complete_itinerary,
        "approval_request": approval_request,
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

        "flight_agent", route_after_agent("flight_agent"), ROUTE_MAP

)

graph.add_conditional_edges(

        "hotel_agent", route_after_agent("hotel_agent"), ROUTE_MAP

)

graph.add_conditional_edges(

        "weather_agent", route_after_agent("weather_agent"), ROUTE_MAP

)

graph.add_conditional_edges(

        "budget_agent", route_after_agent("budget_agent"), ROUTE_MAP

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





def _serialize_result(

        result: dict[str, Any],

        thread_id: str,

) -> dict[str, Any]:

        messages = result.get("messages", [])

        last_message = messages[-1].content if messages else ""

        answer = result.get("final_response") or last_message

        interrupt_payload = _interrupt_payload(result)



        if interrupt_payload:

                answer = interrupt_payload.get("draft_itinerary") or result.get(

                        "itinerary", ""

                )



        return {

                "thread_id": thread_id,

                "answer": answer,

                "requires_approval": interrupt_payload is not None,

                "approval_request": (

                        interrupt_payload.get("approval_request", "")

                        if interrupt_payload

                        else result.get("approval_request", "")

                ),

                "flight_results": result.get("flight_results", ""),

                "hotel_results": result.get("hotel_results", ""),

                "weather_results": result.get("weather_results", ""),

                "budget_results": result.get("budget_results", ""),

                "itinerary": (

                        interrupt_payload.get("draft_itinerary", "")

                        if interrupt_payload

                        else result.get("itinerary", "")

                ),

                "selected_agents": result.get("selected_agents", []),

                "trip_constraints": result.get("trip_constraints", {}),

                "supervisor_reasoning": result.get("supervisor_reasoning", ""),

                "guardrail_allowed": result.get("guardrail_allowed", True),

                "guardrail_reason": result.get("guardrail_reason", ""),

                "approved": result.get("approved"),

                "human_feedback": result.get("human_feedback", ""),

                "llm_calls": result.get("llm_calls", 0),

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

        result = travel_graph.invoke(

                Command(

                        resume={

                                "approved": approved,

                                "feedback": feedback.strip(),

                        }

                ),

                config=config,

        )



        return _serialize_result(result, thread_id)