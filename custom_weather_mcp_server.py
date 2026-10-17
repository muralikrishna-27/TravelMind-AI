import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

mcp = FastMCP("Weather MCP Server")

OPENWEATHER_API_KEY = os.getenv(
    "OPENWEATHER_API_KEY"
)

REQUEST_TIMEOUT_SECONDS = 20


def _get_api_key() -> str:
    if not OPENWEATHER_API_KEY:
        raise RuntimeError(
            "OPENWEATHER_API_KEY is missing "
            "from the project .env file."
        )

    return OPENWEATHER_API_KEY


def _request_json(
    url: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    try:
        response = requests.get(
            url,
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()

        return response.json()

    except requests.RequestException as exc:
        details = ""

        failed_response = getattr(
            exc,
            "response",
            None,
        )

        if failed_response is not None:
            details = (
                f" Response: "
                f"{failed_response.text[:500]}"
            )

        raise RuntimeError(
            f"OpenWeather request failed: "
            f"{exc}.{details}"
        ) from exc


@mcp.tool()
def get_current_weather(
    city: str,
) -> dict[str, Any]:
    """Return the current weather for a city."""

    city = city.strip()

    if not city:
        raise ValueError(
            "city cannot be empty"
        )

    data = _request_json(
        "https://api.openweathermap.org/data/2.5/weather",
        {
            "q": city,
            "appid": _get_api_key(),
            "units": "metric",
        },
    )

    weather_list = data.get("weather", [])
    condition = (
        weather_list[0].get("description", "Unknown")
        if weather_list and isinstance(weather_list[0], dict)
        else "Unknown"
    )
    main_data = data.get("main", {})
    wind_data = data.get("wind", {})

    return {
        "city": data.get("name", city),
        "temperature_c": main_data.get("temp", "N/A"),
        "feels_like_c": main_data.get("feels_like", "N/A"),
        "humidity": main_data.get("humidity", "N/A"),
        "condition": condition,
        "wind_speed": wind_data.get("speed", "N/A"),
    }


@mcp.tool()
def get_forecast(
    city: str,
) -> dict[str, Any]:
    """
    Return the first five three-hour
    forecast entries for a city.
    """

    city = city.strip()

    if not city:
        raise ValueError(
            "city cannot be empty"
        )

    data = _request_json(
        "https://api.openweathermap.org/data/2.5/forecast",
        {
            "q": city,
            "appid": _get_api_key(),
            "units": "metric",
        },
    )

    forecast = []
    for item in data.get("list", [])[:5]:
        if not isinstance(item, dict):
            continue
        w_list = item.get("weather", [])
        c_desc = (
            w_list[0].get("description", "Unknown")
            if w_list and isinstance(w_list[0], dict)
            else "Unknown"
        )
        main_item = item.get("main", {})
        forecast.append(
            {
                "datetime": item.get("dt_txt", ""),
                "temperature_c": main_item.get("temp", "N/A"),
                "condition": c_desc,
            }
        )

    return {
        "city": data.get("city", {}).get("name", city),
        "forecast": forecast,
    }


if __name__ == "__main__":
    # mcp_client.py launches this as a stdio subprocess.
    mcp.run(
        transport="stdio",
    ) 