import asyncio
import logging
import threading
from typing import Dict, Any, AsyncGenerator, Union
from core.analysis.interfaces import IGoEngine
from core.analysis.sync_engine import KataGoEngine as SyncKataGoEngine

logger = logging.getLogger(__name__)


class AsyncKataGoEngine(IGoEngine):
    """
    Wrapper around the synchronous KataGoEngine to provide an async interface.
    This bypasses asyncio subprocess pipe issues by using threading/blocking I/O via the robust SyncKataGoEngine.
    """

    def __init__(self, katago_path: str, config_path: str, model_path: str):
        # Initialize the synchronous engine
        self.sync_engine = SyncKataGoEngine(katago_path, config_path, model_path)

    async def start(self) -> None:
        """Start the synchronous engine in a separate thread to avoid blocking the loop."""
        logger.info("Starting Synchronous KataGo Engine (wrapped in Async)...")
        # Run the blocking start() method in a thread
        await asyncio.to_thread(self.sync_engine.start)

    async def analyze(
        self,
        sgf_content: str,
        visits: int,
        timeout: int = 120,
        start_turn: int | None = None,
        end_turn: int | None = None,
    ) -> str:
        """
        Non-streaming analysis (not implemented - use analyze_streaming instead).
        This method exists to satisfy the IGoEngine interface.
        """
        raise NotImplementedError("Use analyze_streaming instead")

    async def analyze_streaming(
        self,
        sgf_content: str,
        visits: int,
        start_turn: int | None = None,
        end_turn: int | None = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Bridge the synchronous generator to an async generator using a Queue and a Thread.
        This allows the blocking sync generator to yield results that are consumed asynchronously.
        """
        queue: asyncio.Queue[Union[Dict[str, Any], Exception, None]] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def producer():
            try:
                # Run the sync generator (blocking)
                gen = self.sync_engine.analyze_streaming_generator(
                    sgf_content, visits, start_turn, end_turn
                )
                for item in gen:
                    # Put item in queue safely from thread
                    loop.call_soon_threadsafe(queue.put_nowait, item)
                # Signal EOF
                loop.call_soon_threadsafe(queue.put_nowait, None)
            except Exception as e:
                logger.error(f"Sync Producer Error: {e}")
                loop.call_soon_threadsafe(queue.put_nowait, e)

        # Start producer thread
        threading.Thread(target=producer, daemon=True).start()

        # Consume queue
        while True:
            # Wait for next item
            item = await queue.get()

            if item is None:
                # EOF
                break

            if isinstance(item, Exception):
                raise item

            yield item

    def close(self) -> None:
        """Close the synchronous engine."""
        self.sync_engine.close()

    def is_running(self) -> bool:
        return bool(self.sync_engine.is_running())
