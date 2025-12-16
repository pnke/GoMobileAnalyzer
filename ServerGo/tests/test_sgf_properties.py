import sys
from pathlib import Path

# Add ServerGo to path
server_path = Path(__file__).parent.parent
sys.path.insert(0, str(server_path))

import pytest  # noqa: E402
from hypothesis import given, strategies as st, settings, HealthCheck  # noqa: E402
from core.sgf.validator import validate_sgf, SGFValidationError  # noqa: E402

# Strategy for generating random strings
# We want to test robustness against ANY input, including garbage
random_strings = st.text()


class TestSGFProperties:
    @given(random_strings)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_validator_rejects_garbage(self, sgf_content):
        """
        The validator should reject garbage input, but never crash.
        """
        try:
            validate_sgf(sgf_content)
        except SGFValidationError:
            # Expected for garbage
            pass
        except Exception as e:
            # If validate_sgf raises something else, it might be a bug in the validator wrapper
            # However, validate_sgf calls parse_sgf, so it might bubble up.
            # We want to ensure validate_sgf wraps errors in SGFValidationError usually,
            # but if it lets ValueError through, that's also a "crash" in the context of a validator.
            # Let's fail if it's not SGFValidationError (unless it's a valid SGF which is unlikely for random text)

            # Note: If random text happens to be valid SGF, validate_sgf returns string.
            # If it's invalid, it should raise SGFValidationError.
            # Any other exception is a failure of the validator to handle the input.
            pytest.fail(
                f"Validator crashed with unexpected exception: {type(e).__name__}: {e}"
            )

    @given(st.text(min_size=1000, max_size=5000))
    @settings(max_examples=20, suppress_health_check=[HealthCheck.too_slow])
    def test_large_input_robustness(self, large_input):
        """Test with larger inputs to check for recursion depth issues or performance crashes"""
        try:
            validate_sgf(large_input)
        except SGFValidationError:
            pass
        except RecursionError:
            pytest.fail("Validator hit recursion limit on large input")
        except Exception:
            # Other exceptions are handled in the previous test
            pass
