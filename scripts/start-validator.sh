#!/bin/bash
here="$(dirname "$0")"
root=$here/..

test_fixtures=$root/test/fixtures

ARGS=(
  -r
  -q
  --bpf-program TACLkU6CiCdkQN2MjoyDkVg2yAH9zkxiHDsiztQ52TP $test_fixtures/token_acl.so
  --bpf-program GATEzzqxhJnsWF6vHRsgtixxSB8PaQdcqGEVTEHWiULz $test_fixtures/allow_block_list.so
)
PORT=8899
PID=$(lsof -t -i:$PORT)

if [ -n "$PID" ]; then
  echo "Detected test validator running on PID $PID. Restarting..."
  kill "$PID"
  sleep 1
fi

echo "Starting Solana test validator..."
solana-test-validator "${ARGS[@]}" &
VALIDATOR_PID=$!

# Wait for test validator to move past slot 0.
echo -n "Waiting for validator to stabilize"
sleep 10
for i in {1..8}; do
  if ! kill -0 "$VALIDATOR_PID" 2>/dev/null; then
    echo -e "\nTest validator exited early."
    exit 1
  fi

  SLOT=$(solana slot -ul 2>/dev/null)
  if [[ "$SLOT" =~ ^[0-9]+$ ]] && [ "$SLOT" -gt 0 ]; then
    echo -e "\nTest validator is ready. Slot: $SLOT"
    exit 0
  fi

  echo -n "."
  sleep 1
done

echo -e "\nTimed out waiting for test validator to stabilize."
exit 1
