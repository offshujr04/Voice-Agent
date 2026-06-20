"""
Publish a UI action into a room exactly like the agent does — to test the
widget's redirect/navigation handling without needing a mic.

Run:  uv run python scripts/publish_action.py <room> '<json action>'
e.g.: uv run python scripts/publish_action.py voice_assistant_room_4837 \
        '{"action":"redirect","url":"http://localhost:3001/pricing","label":"Pricing"}'
"""
import asyncio
import os
import sys

from dotenv import load_dotenv
from livekit import api, rtc

load_dotenv(".env.local")

UI_ACTION_TOPIC = "lk.ui.action"


async def main():
    room_name = sys.argv[1]
    payload = sys.argv[2] if len(sys.argv) > 2 else '{"action":"redirect","url":"/pricing"}'

    url = os.environ["LIVEKIT_URL"]
    key = os.environ["LIVEKIT_API_KEY"]
    secret = os.environ["LIVEKIT_API_SECRET"]

    token = (
        api.AccessToken(key, secret)
        .with_identity("action_publisher")
        .with_grants(api.VideoGrants(room_join=True, room=room_name,
                                     can_publish=True, can_publish_data=True,
                                     can_subscribe=True))
        .to_jwt()
    )

    room = rtc.Room()
    await room.connect(url, token)
    print(f"connected to {room_name}; participants: "
          f"{[p.identity for p in room.remote_participants.values()]}")
    await asyncio.sleep(0.5)
    await room.local_participant.publish_data(
        payload.encode("utf-8"), reliable=True, topic=UI_ACTION_TOPIC
    )
    print(f"published on '{UI_ACTION_TOPIC}': {payload}")
    await asyncio.sleep(1.0)
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
