# Exponential backoff with jitter and circuit breaker
# Circuit breaker opens after consecutive failures and prevents further requests
# Note: This uses global state to track circuit breaker across all clients
#
# - Implements a global circuit breaker that opens after consecutive failures
# - Prevents requests when circuit is open (recovery timeout)
# - Uses half-open state to test server recovery with limited requests
# - Automatically closes circuit after successful half-open requests
# - Protects server from continued load when it's struggling


MAX_RETRIES = 5
DEFAULT_HTTP_TIMEOUT = 10000
INTERVAL_MILLIS = 500  # 0.5 sec                 # The amount of milliseconds to exponentially increase
BACKOFF_FACTOR = 2                               # The factor to backoff by
BACKOFF_LIMIT_MILLIS = 10 * 60 * 1000  # 10 min  # The maximum milliseconds to increase to
RANDOM_FACTOR = 0.2                              # The percentage of backoff time to randomize by

FAILURE_THRESHOLD = 10           # Open circuit after 10 consecutive failures
RECOVERY_TIMEOUT = 10000         # 10 seconds before trying half-open state
HALF_OPEN_SUCCESS_THRESHOLD = 3  # Successful requests needed to close circuit
HALF_OPEN_MAX_REQUESTS = 3       # Max concurrent requests in half-open state


def set_state():
    return {
        "state": "closed",  # "closed", "open", or "half_open"
        "failure_count": 0,
        "last_failure_time": 0,
        "half_open_successes": 0,
        "half_open_active_requests": 0
    }


def calculate_backoff_millis(count):
    # Calculate exponential base delay
    base = INTERVAL_MILLIS * int(pow(BACKOFF_FACTOR, count))

    # Add bounded jitter: ±(random_factor * base)
    # random() returns [0, 1), so (random() - 0.5) * 2 gives us [-1, 1)
    fuzz_range = RANDOM_FACTOR * base
    fuzz = int(fuzz_range * (random() - 0.5) * 2)

    result = base + fuzz

    # Ensure result is within bounds
    return min(BACKOFF_LIMIT_MILLIS, max(INTERVAL_MILLIS, result))


def on_request(req):
    state = get_state()
    current_time = now()

    if "retry_count" not in req["meta"]:
        req["meta"]["retry_count"] = 0

    # Check if circuit should transition from open to half-open
    if state["state"] == "open":
        if current_time - state["last_failure_time"] > RECOVERY_TIMEOUT:
            state["state"] = "half_open"
            state["half_open_successes"] = 0
            state["half_open_active_requests"] = 0
        else:
            # Circuit is still open, block the request
            return {"allow": False, "delay": 0}

    # In half-open state, only allow limited requests
    if state["state"] == "half_open":
        if state["half_open_active_requests"] >= HALF_OPEN_MAX_REQUESTS:
            return {"allow": False, "delay": 0}

        state["half_open_active_requests"] += 1

    return {"allow": True, "delay": 0, "timeout": DEFAULT_HTTP_TIMEOUT}


def on_response(req, resp):
    state = get_state()

    # Handle successful response based on circuit state
    if state["state"] == "half_open":
        state["half_open_active_requests"] -= 1
        state["half_open_successes"] += 1

        # Close circuit if enough successful requests in half-open state
        if state["half_open_successes"] >= HALF_OPEN_SUCCESS_THRESHOLD:
            state["state"] = "closed"
            state["failure_count"] = 0
            state["half_open_successes"] = 0

    elif state["state"] == "closed":
        # Reset failure count on successful response
        state["failure_count"] = 0


def on_error(req, resp):
    state = get_state()

    # Handle error based on circuit state
    if state["state"] == "half_open":
        state["half_open_active_requests"] -= 1

        # Reopen circuit immediately on failure in half-open state
        state["state"] = "open"
        state["last_failure_time"] = now()
        state["half_open_successes"] = 0

    elif state["state"] == "closed":
        state["failure_count"] += 1
        state["last_failure_time"] = now()

        # Open circuit breaker if threshold exceeded
        if state["failure_count"] >= FAILURE_THRESHOLD:
            state["state"] = "open"


def on_fail(req, err):
    state = get_state()

    # Handle failure based on circuit state
    if state["state"] == "half_open":
        state["half_open_active_requests"] -= 1

        # Reopen circuit immediately on failure in half-open state
        state["state"] = "open"
        state["last_failure_time"] = now()
        state["half_open_successes"] = 0

    elif state["state"] == "closed":
        state["failure_count"] += 1
        state["last_failure_time"] = now()

        # Open circuit breaker if threshold exceeded
        if state["failure_count"] >= FAILURE_THRESHOLD:
            state["state"] = "open"


def on_retry(req, resp, err):
    state = get_state()

    # Don't retry if circuit breaker is open
    if state["state"] == "open":
        return {"allow": False, "delay": 0}

    if req["meta"]["retry_count"] < MAX_RETRIES:
        req["meta"]["retry_count"] += 1

        # Calculate backoff with bounded jitter
        delay = calculate_backoff_millis(req["meta"]["retry_count"] - 1)

        return {"allow": True, "delay": delay}

    return {"allow": False, "delay": 0}
