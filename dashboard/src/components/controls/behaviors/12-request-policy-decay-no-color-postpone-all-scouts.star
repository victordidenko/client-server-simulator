# Adaptive Backoff Policy with Failure Severity Weighting & Scout Probes
# Uses request duration to determine failure severity and calculate appropriate backoff
# Decays old failures to reduce their impact
# Pospone requests which are close to the backoff end
# Implements scout probes to detect service recovery during backoff periods
#
# - Weights failures based on how long they took (timeouts are worse than quick failures)
# - Uses sliding window to track recent failure patterns
# - Implements gradual recovery with reduced backoff after first success
# - Scout probes (one per 10s) test service during backoff without penalty
# - Combines global backoff policy with per-request retry logic


MAX_RETRIES = 5
DEFAULT_HTTP_TIMEOUT = 10000
INTERVAL_MILLIS = 500  # 0.5 sec                 # The amount of milliseconds to exponentially increase
BACKOFF_FACTOR = 2                               # The factor to backoff by
BACKOFF_LIMIT_MILLIS = 10 * 60 * 1000  # 10 min  # The maximum milliseconds to increase to
RANDOM_FACTOR = 0.2                              # The percentage of backoff time to randomize by

HTTP_LATENCY = 500  # Expected normal latency: 0.5 seconds
MIN_DURATION = HTTP_LATENCY
MAX_DURATION = DEFAULT_HTTP_TIMEOUT - HTTP_LATENCY
MAX_RETRY_DELAY = 60 * 1000  # 1 minute max retry delay

SCOUT_INTERVAL = 10 * 1000  # 10 seconds between scout probes


def set_state():
    return {
        "bucket": {
            "limit": 0,  # Timestamp before which requests are prohibited
            "failures": [],  # List of [timestamp, weight] pairs
            "backoff": 0,  # Last calculated backoff in milliseconds
            "successes": 0,  # Counter of successful requests after failures
            "last_scout_time": 0  # Timestamp of last scout probe attempt
        }
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


# Calculate request weight directly from duration using quadratic function
# Quick failures (near MIN_DURATION) have weight ~1, timeouts grow quadratically to ~4
def weight_from_duration(duration):
    if duration <= MIN_DURATION:
        return 1.0
    if duration >= MAX_DURATION:
        return 4.0

    # Normalize duration to 0-1 range
    normalized = (duration - MIN_DURATION) / float(MAX_DURATION - MIN_DURATION)

    # Apply quadratic function: weight ranges from 1.0 to 4.0
    # Formula: 1 + 3 * normalized^2
    w = 1.0 + 3.0 * (normalized * normalized)
    return w


# Check if request should be blocked based on current adaptive backoff limit
def on_request(req):
    state = get_state()
    bucket = state["bucket"]
    current_time = now()

    # Store request start time for duration calculation
    req["meta"]["start_time"] = current_time

    # Check if we're still in backoff period
    if current_time <= bucket["limit"]:
        # Check if enough time passed for a scout probe
        if current_time - bucket["last_scout_time"] >= SCOUT_INTERVAL:
            # Allow scout probe - mark it as such
            bucket["last_scout_time"] = current_time
            req["meta"]["is_scout"] = True
            return {"allow": True, "timeout": DEFAULT_HTTP_TIMEOUT}

        # Not time for scout yet, check postpone delay logic
        jitter = int(random() * MAX_DURATION)
        remaining_delay = (bucket["limit"] + jitter) - current_time

        if remaining_delay < MAX_DURATION:
            return {"allow": True, "delay": remaining_delay}

        return {"allow": False, "delay": 0}

    return {"allow": True, "delay": 0, "timeout": DEFAULT_HTTP_TIMEOUT}


# Handle successful response - implement gradual recovery
def on_response(req, resp):
    state = get_state()
    bucket = state["bucket"]

    # Only process if we have failure data
    if not bucket["failures"]:
        return

    if bucket["successes"] < 1:
        # First success after failures - reduce backoff
        bucket["successes"] += 1
        bucket["backoff"] = max(int(bucket["backoff"] / BACKOFF_FACTOR), INTERVAL_MILLIS)
        bucket["limit"] = now()
    else:
        # Second success - full recovery, clear all failure state
        bucket["limit"] = 0
        bucket["failures"] = []
        bucket["backoff"] = 0
        bucket["successes"] = 0


# Handle error response
def on_error(req, resp):
    handle_failure(req)


# Handle network failure
def on_fail(req, err):
    handle_failure(req)


# Common failure handling logic with severity-based backoff
def handle_failure(req):
    # Don't penalize failed scout probes
    if req["meta"].get("is_scout"):
        return

    state = get_state()
    bucket = state["bucket"]
    current_time = now()

    # Calculate request duration and determine failure severity
    start_time = req["meta"].get("start_time", current_time)
    duration = current_time - start_time
    weight = weight_from_duration(duration)

    if not bucket["failures"]:
        # First failure - initialize bucket data
        bucket["backoff"] = calculate_backoff_millis(weight)
        bucket["limit"] = current_time + bucket["backoff"]
        bucket["failures"] = [[current_time, weight]]
        bucket["successes"] = 0
    else:
        # Additional failure - calculate cumulative weight from sliding window
        window = int((BACKOFF_FACTOR + 1) * bucket["backoff"])
        window_start = current_time - window

        # Sum weights of recent failures within the window WITH DECAY
        weights_sum = 0.0
        for failure_time, failure_weight in bucket["failures"]:
            if failure_time >= window_start:
                # Apply exponential decay based on age
                age = current_time - failure_time
                age_ratio = age / float(window)
                decay_factor = pow(0.5, age_ratio)  # Halves at window boundary

                weights_sum += failure_weight * decay_factor

        # Calculate new backoff based on total accumulated weight
        total_count = weight + weights_sum
        bucket["backoff"] = calculate_backoff_millis(total_count)
        bucket["limit"] = current_time + bucket["backoff"]
        bucket["failures"].append([current_time, weight])
        bucket["successes"] = 0

        # Clean up old failures outside cleanup window
        cleanup_threshold = current_time - ((BACKOFF_FACTOR + 1) * BACKOFF_LIMIT_MILLIS)
        bucket["failures"] = [[t, w] for t, w in bucket["failures"] if t > cleanup_threshold]


# Retry logic respecting both global adaptive backoff and per-request retry backoff
def on_retry(req, resp, err):
    state = get_state()
    bucket = state["bucket"]
    current_time = now()

    # Get or initialize retry attempt count for this specific request
    retry_count = req["meta"].get("retry_count", 0)

    # Check if max retries exceeded
    if retry_count >= MAX_RETRIES:
        return {"allow": False, "delay": 0}

    req["meta"]["retry_count"] = retry_count + 1

    # Calculate individual retry backoff (separate from global policy)
    retry_backoff = calculate_backoff_millis(retry_count)

    # Calculate when global adaptive policy allows requests
    global_backoff_end = bucket["limit"]

    # Determine the actual delay needed
    if current_time >= global_backoff_end:
        # Global policy allows requests, use individual retry backoff
        delay = retry_backoff
    else:
        # Global policy is blocking, wait for the longer of the two
        global_remaining = global_backoff_end - current_time
        delay = max(retry_backoff, global_remaining)

    # Check if delay exceeds maximum threshold
    if delay > MAX_RETRY_DELAY:
        return {"allow": False, "delay": 0}

    return {"allow": True, "delay": delay}
