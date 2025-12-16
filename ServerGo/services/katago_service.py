import asyncio
import logging
from typing import Callable, Optional, Any, Dict, AsyncGenerator
from config import config, Config
from core.analysis.async_engine import AsyncKataGoEngine
from core.analysis.interfaces import IGoEngine

logger = logging.getLogger(__name__)


class KataGoService:
    def __init__(self, engine_factory: Callable[[], IGoEngine], config_obj: Config):
        self.engine: Optional[IGoEngine] = None
        self.lock = asyncio.Lock()
        self.watchdog_task: Optional[asyncio.Task] = None
        self.engine_factory = engine_factory
        self.config = config_obj

    async def _start_engine_process(self) -> None:
        """Internal method to start the engine process."""
        self.engine = self.engine_factory()
        # Async engine needs explicit start await
        if hasattr(self.engine, "start"):
            await self.engine.start()  # type: ignore

    async def start(self) -> None:
        """Starts the KataGo process using the shared engine."""
        logger.info("Starting KataGo service...")
        try:
            await self._start_engine_process()
            logger.info("KataGo started and ready for requests.")

            # Start watchdog if not running
            if self.watchdog_task is None or self.watchdog_task.done():
                self.watchdog_task = asyncio.create_task(self._watchdog_loop())

        except Exception as e:
            logger.error("Failed to start KataGo: %s", e)
            self.engine = None

    async def stop(self) -> None:
        """Stops the KataGo process."""
        # Stop watchdog first
        if self.watchdog_task:
            self.watchdog_task.cancel()
            try:
                await self.watchdog_task
            except asyncio.CancelledError:
                pass
            self.watchdog_task = None

        if self.engine:
            logger.info("Stopping KataGo...")
            self.engine.close()
            self.engine = None
            logger.info("KataGo stopped.")

    def is_running(self) -> bool:
        """Check if engine is running."""
        return self.engine is not None and self.engine.is_running()

    async def _watchdog_loop(self) -> None:
        """Background task to monitor and restart KataGo."""
        logger.info("KataGo Watchdog started.")
        while True:
            await asyncio.sleep(30)  # Check every 30 seconds

            # Use lock to ensure we don't conflict with active analysis or manual starts
            async with self.lock:
                if self.engine:
                    if not self.engine.is_running():
                        logger.warning("Watchdog detected KataGo crash! Restarting...")
                        try:
                            self.engine.close()
                        except Exception:
                            pass
                        self.engine = None

                        try:
                            await self._start_engine_process()
                            logger.info("Watchdog successfully restarted KataGo.")
                        except Exception as e:
                            logger.error("Watchdog failed to restart KataGo: %s", e)

    async def analyze(
        self,
        sgf_content: str,
        visits: int = 1000,
        start_turn: Optional[int] = None,
        end_turn: Optional[int] = None,
    ) -> str:
        """
        Analyzes an SGF game using the KataGo engine.

        Args:
            sgf_content: Raw SGF string to analyze.
            visits: Number of MCTS visits per position (default 1000).
            start_turn: Optional starting turn for partial analysis.
            end_turn: Optional ending turn for partial analysis.

        Returns:
            str: Analyzed SGF with winrate/score annotations in comments.

        Raises:
            SGFValidationError: If the SGF is malformed.
            RuntimeError: If the engine is not running and cannot restart.
        """
        # Lazy import to avoid circular dependencies if any
        from core.sgf.validator import validate_sgf

        # Validate Input
        validated_sgf = validate_sgf(sgf_content)

        async with self.lock:
            if not self.engine or not self.engine.is_running():
                logger.warning("KataGo engine not running. Attempting to restart...")
                await self.start()
                if not self.engine or not self.engine.is_running():
                    raise RuntimeError(
                        "KataGo engine is not running and could not be restarted."
                    )

            # Run async analyze directly
            # Run async analyze directly
            try:
                result_sgf = await self.engine.analyze(
                    validated_sgf,
                    visits,
                    timeout=int(self.config.KATAGO_TIMEOUT_SEC),
                    start_turn=start_turn,
                    end_turn=end_turn,
                )
                return result_sgf
            except Exception as e:
                logger.error("Error during analysis: %s", e)
                raise

    async def analyze_stream(
        self,
        sgf_content: str,
        visits: int = 1000,
        start_turn: Optional[int] = None,
        end_turn: Optional[int] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream analysis results for each move in the game.

        This is an asynchronous generator that yields analysis results for
        each turn.

        Args:
            sgf_content: Raw SGF string to analyze.
            visits: Number of MCTS visits per position.
            start_turn: Optional starting turn for partial analysis.
            end_turn: Optional ending turn for partial analysis.

        Yields:
            dict: Analysis result for each turn containing winrate, score,
                  and top move suggestions.

        Raises:
            SGFValidationError: If the SGF is malformed.
            RuntimeError: If the engine is not running.
        """
        from core.sgf.validator import validate_sgf

        # Validate Input
        validated_sgf = validate_sgf(sgf_content)

        if not self.engine or not self.engine.is_running():
            raise RuntimeError("KataGo engine is not running")

        async for result in self.engine.analyze_streaming(
            validated_sgf, visits, start_turn=start_turn, end_turn=end_turn
        ):
            yield result


# Default factory
def default_engine_factory() -> IGoEngine:
    return AsyncKataGoEngine(
        config.KATAGO_PATH, config.KATAGO_CONFIG, config.KATAGO_MODEL
    )


# Singleton instance with default factory
katago_service = KataGoService(default_engine_factory, config)


def get_katago_service() -> KataGoService:
    """Dependency provider for KataGoService"""
    return katago_service
