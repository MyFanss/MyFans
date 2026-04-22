#!/bin/bash

# Generate changelog from conventional commits
# Usage: ./generate-changelog.sh

# Check if conventional-changelog-cli is available
if ! command -v conventional-changelog &> /dev/null; then
    echo "conventional-changelog-cli not found. Installing globally..."
    npm install -g conventional-changelog-cli
fi

# Generate changelog
conventional-changelog -p angular -i CHANGELOG.md -s -r 0

echo "Changelog generated in CHANGELOG.md"