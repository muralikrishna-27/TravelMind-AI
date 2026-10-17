import os
import traceback

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from backend import (
    run_travel_agent,
    resume_travel_agent,
    start_travel_agent_stream,
    start_resume_travel_agent_stream,
    get_trip_snapshot,
    subscribe_trip_events,
    is_postgres_connected,
)

# This is kept from the original project to allow the existing synchronous
# agent functions to call async MCP helpers inside FastAPI.
import nest_asyncio

nest_asyncio.apply()

app = FastAPI(
    title="TravelMind AI",
    description=(
        """Search flights, discover hotels, check weather, assess your budget,
        and review the AI-generated draft before the final itinerary is created."""
    ),
    version="2.0.0",
)

allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$" if os.getenv("ALLOW_VERCEL_PREVIEWS", "true").lower() == "true" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TravelRequest(BaseModel):
    message: str = Field(max_length=1000)
    thread_id: str | None = None
    sync: bool = False


class ApprovalRequest(BaseModel):
    thread_id: str = Field(min_length=1)
    approved: bool
    feedback: str = Field(default="", max_length=1000)
    sync: bool = False


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "TravelMind AI API",
        "version": "2.0.0",
    }


@app.post("/api/travel")
async def travel_planner(request_data: TravelRequest):
    try:
        user_message = request_data.message.strip()

        if not user_message:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Message cannot be empty.",
                },
            )

        if request_data.sync:
            result = run_travel_agent(
                user_input=user_message,
                thread_id=request_data.thread_id,
            )
        else:
            result = start_travel_agent_stream(
                user_input=user_message,
                thread_id=request_data.thread_id,
            )

        return JSONResponse(
            content={
                "success": True,
                **result,
            }
        )

    except Exception as exc:
        print("ERROR:", exc)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Unable to start trip planning right now.",
            },
        )


@app.get("/api/travel/{thread_id}")
async def travel_snapshot(thread_id: str):
    try:
        snapshot = get_trip_snapshot(thread_id)
        if snapshot is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "Trip session not found.",
                },
            )
        return JSONResponse(
            content={
                "success": True,
                **snapshot,
            }
        )
    except Exception as exc:
        print("SNAPSHOT ERROR:", exc)
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Unable to load trip snapshot.",
            },
        )


@app.get("/api/travel/{thread_id}/events")
async def travel_events(thread_id: str):
    return StreamingResponse(
        subscribe_trip_events(thread_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/travel/approve")
async def approve_travel_plan(request_data: ApprovalRequest):
    try:
        if not request_data.approved and not request_data.feedback.strip():
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Please provide revision feedback when requesting changes.",
                },
            )

        if request_data.sync:
            result = resume_travel_agent(
                thread_id=request_data.thread_id,
                approved=request_data.approved,
                feedback=request_data.feedback,
            )
        else:
            result = start_resume_travel_agent_stream(
                thread_id=request_data.thread_id,
                approved=request_data.approved,
                feedback=request_data.feedback,
            )

        return JSONResponse(
            content={
                "success": True,
                **result,
            }
        )

    except Exception as exc:
        print("APPROVAL ERROR:", exc)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Unable to process your review right now.",
            },
        )


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "message": "TravelMind AI API is running",
        "checkpointer": "postgres" if is_postgres_connected() else "memory",
        "features": [
            "supervisor_agent",
            "input_guardrail",
            "human_in_the_loop",
            "sse_streaming",
        ],
    }


@app.get("/favicon.ico")
async def favicon():
    return JSONResponse(content={})


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )