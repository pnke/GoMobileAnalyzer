import asyncio
import unittest
from tests import test_katago_communication, test_api


# Wrap async tests
def async_test(coro):
    def wrapper(*args, **kwargs):
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro(*args, **kwargs))
        finally:
            loop.close()

    return wrapper


class TestBackend(unittest.TestCase):
    def test_analyze_success(self):
        async_test(test_katago_communication.test_analyze_success)()

    def test_analyze_restart_failure(self):
        async_test(test_katago_communication.test_analyze_restart_failure)()

    def test_analyze_auto_restart(self):
        async_test(test_katago_communication.test_analyze_auto_restart)()

    def test_ping(self):
        test_api.test_ping()

    def test_health(self):
        test_api.test_health()

    def test_analyze_endpoint(self):
        test_api.test_analyze_endpoint()


if __name__ == "__main__":
    unittest.main()
