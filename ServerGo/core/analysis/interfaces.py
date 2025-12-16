from typing import Protocol, AsyncGenerator, Awaitable


class IGoEngine(Protocol):
    def analyze(
        self,
        sgf_content: str,
        visits: int,
        timeout: int = 120,
        start_turn: int | None = None,
        end_turn: int | None = None,
    ) -> Awaitable[str]:
        """
        Analyzes the given SGF content.
        Returns the SGF with analysis results.
        """
        ...

    def close(self) -> None:
        """
        Stops the engine and releases resources.
        """
        ...

    def is_running(self) -> bool:
        """
        Returns True if the engine is currently running and healthy.
        """
        ...

    def analyze_streaming(
        self,
        sgf_content: str,
        visits: int,
        start_turn: int | None = None,
        end_turn: int | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Streams analysis results for the given SGF content.
        """
        ...
