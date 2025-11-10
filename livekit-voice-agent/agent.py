from dotenv import load_dotenv
import os
from livekit import agents
<<<<<<< HEAD
from livekit.agents import AgentSession, Agent, RoomInputOptions,RoomOutputOptions
from livekit.plugins import noise_cancellation, silero,anam
from livekit.plugins.turn_detector.multilingual import MultilingualModel
=======
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import noise_cancellation, silero, bey
>>>>>>> a94562e (final livekit voice agent with avatar)

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )


def convert_to_websocket_url(url: str) -> str:
    """Convert HTTP(S) URL to WebSocket WS(S) URL."""
    if url.startswith('https://'):
        return url.replace('https://', 'wss://', 1)
    elif url.startswith('http://'):
        return url.replace('http://', 'ws://', 1)
    return url


async def entrypoint(ctx: agents.JobContext):
    # LiveKit Cloud automatically injects these environment variables
    # but the URL might be in HTTPS format, so we need to convert it
    livekit_url = os.environ.get('LIVEKIT_URL', '')
    livekit_api_key = os.environ.get('LIVEKIT_API_KEY', '')
    livekit_api_secret = os.environ.get('LIVEKIT_API_SECRET', '')
    
    # Convert URL to WebSocket format if needed
    if livekit_url:
        livekit_url = convert_to_websocket_url(livekit_url)
        print(f"Using LiveKit URL: {livekit_url}")
    
    # Verify all credentials are present
    if not livekit_url or not livekit_api_key or not livekit_api_secret:
        print("ERROR: Missing LiveKit credentials!")
        print(f"LIVEKIT_URL present: {bool(livekit_url)}")
        print(f"LIVEKIT_API_KEY present: {bool(livekit_api_key)}")
        print(f"LIVEKIT_API_SECRET present: {bool(livekit_api_secret)}")
        raise ValueError("LiveKit credentials not found in environment variables")
    
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4.1-mini",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
    )

<<<<<<< HEAD
    avatar = anam.AvatarSession(
      persona_config=anam.PersonaConfig(
         name="Cara",  # Name of the avatar to use.
         avatarId="d9ebe82e-2f34-4ff6-9632-16cb73e7de08",  # ID of the avatar to use. See "Avatar setup" for details.
      ),
    )


    await avatar.start(session, room=ctx.room)

=======
    # Create avatar session - pass all three required parameters
    avatar = bey.AvatarSession(
        avatar_id="694c83e2-8895-4a98-bd16-56332ca3f449",
    )

    # Start avatar with all required credentials in WebSocket format
    print("Starting avatar session...")
    await avatar.start(
        session, 
        room=ctx.room,
        livekit_url=livekit_url,
        livekit_api_key=livekit_api_key,
        livekit_api_secret=livekit_api_secret
    )
    print("Avatar session started successfully!")
    
>>>>>>> a94562e (final livekit voice agent with avatar)
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(), 
        ),
    )

    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )

    async def cleanup():
        try:
            print("Cleaning up — stopping avatar...")
            await avatar.stop()
        except Exception as e:
            print(f"Error stopping avatar: {e}")

        try:
            print("Disconnecting room...")
            await ctx.room.disconnect()
            print("Room disconnected.")
        except Exception as e:
            print(f"Error disconnecting room: {e}")

    # Register cleanup callback with job context
    ctx.add_shutdown_callback(cleanup)


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint
        )
    )