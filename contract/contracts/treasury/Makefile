.PHONY: build test verify clean

WASM_PATH := ../../target/wasm32-unknown-unknown/release/treasury.wasm

build:
	cargo build --target wasm32-unknown-unknown --release

test:
	cargo test --lib

verify: build
	@if [ ! -f "$(WASM_PATH)" ]; then \
		echo "ERROR: WASM artifact not found at $(WASM_PATH)"; \
		exit 1; \
	fi
	@SIZE=$$(wc -c < "$(WASM_PATH)"); \
	if [ "$$SIZE" -lt 100 ]; then \
		echo "ERROR: WASM artifact is suspiciously small ($$SIZE bytes)"; \
		exit 1; \
	fi; \
	echo "WASM verified: $(WASM_PATH) ($$SIZE bytes)"

clean:
	cargo clean
