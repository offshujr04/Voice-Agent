"""
Headless end-to-end probe of the agent's UI-action data channel.

Joins a room (with agent dispatch), sends a text turn on lk.chat (no mic needed),
and listens for the agent to publish a UI action on lk.ui.action. Confirms the
bridge actually forwards redirect/history actions to the frontend.

Run:  uv run python scripts/probe_data_channel.py "what are your prices"
"""
import asyncio
import os
import sys

from dotenv import load_dotenv
from livekit import api, rtc

load_dotenv(".env.local")

UI_ACTION_TOPIC = "lk.ui.action"
CHAT_TOPIC = "lk.chat"
AGENT_NAME = "assistant-2473"


async def main():
    prompt = sys.argv[1] if len(sys.argv) > 1 else "what are your prices"
    url = os.environ["LIVEKIT_URL"]
    key = os.environ["LIVEKIT_API_KEY"]
    secret = os.environ["LIVEKIT_API_SECRET"]
    room_name = "probe_room_data_channel"

    token = (
        api.AccessToken(key, secret)
        .with_identity("probe_user")
        .with_name("probe")
        .with_grants(api.VideoGrants(room_join=True, room=room_name,
                                     can_publish=True, can_subscribe=True,
                                     can_publish_data=True))
        .with_room_config(
            api.RoomConfiguration(
                agents=[api.RoomAgentDispatch(agent_name=AGENT_NAME)]
            )
        )
        .to_jwt()
    )

    room = rtc.Room()
    received: list = []

    @room.on("data_received")
    def on_data(data: rtc.DataPacket):
        if data.topic == UI_ACTION_TOPIC:
            received.append(data.data.decode("utf-8"))
            print(f"  <-- UI ACTION on '{data.topic}': {data.data.decode('utf-8')}")

    @room.on("participant_connected")
    def on_join(p: rtc.RemoteParticipant):
        print(f"  participant joined: {p.identity} (kind={p.kind})")

    await room.connect(url, token)
    print(f"connected to room '{room_name}' as probe_user")

    # Wait for the agent to join.
    for _ in range(20):
        if any(p.identity.startswith("agent") or p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT
               for p in room.remote_participants.values()):
            break
        await asyncio.sleep(0.5)
    print(f"remote participants: {[p.identity for p in room.remote_participants.values()]}")

    # Send a text turn to the agent (treated as a user message).
    print(f"--> sending text turn: {prompt!r}")
    await room.local_participant.send_text(prompt, topic=CHAT_TOPIC)

    # Give the agent time to think, call the tool, and publish the action.
    for _ in range(30):
        if received:
            break
        await asyncio.sleep(0.5)

    await asyncio.sleep(1.0)
    print("\n=== RESULT ===")
    print(f"UI actions received: {len(received)}")
    for r in received:
        print(" ", r)
    await room.disconnect()
    sys.exit(0 if received else 2)


if __name__ == "__main__":
    asyncio.run(main())
