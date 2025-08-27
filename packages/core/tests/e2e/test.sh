#!/bin/bash

# DeFiShArd SDK Test Runner
# Simple wrapper script for running automated tests

set -e

cd "$(dirname "$0")/../.."

echo "🚀 DeFiShArd SDK Test Runner"
echo "=============================="

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed. Please install Deno first:"
    echo "   curl -fsSL https://deno.land/install.sh | sh"
    exit 1
fi

# Parse arguments
case "${1:-quick}" in
    "quick"|"q")
        echo "🏃 Running quick test (2-of-2)..."
        sleep 1
        deno run --allow-all --unstable-sloppy-imports tests/e2e/quick-test.ts
        ;;
    "auto"|"a")
        echo "🤖 Running automated test with options: ${@:2}"
        sleep 1
        deno run --allow-all --unstable-sloppy-imports tests/e2e/auto-test.ts "${@:2}"
        ;;
    "setup")
        echo "⚙️ Running setup only..."
        deno run --allow-all --unstable-sloppy-imports tests/e2e/party.ts setup
        ;;
    "keygen")
        echo "🔑 Running keygen test..."
        sleep 1
        deno run --allow-all --unstable-sloppy-imports tests/e2e/auto-test.ts --only=keygen
        ;;
    "sign")
        echo "✍️ Running signing test..."
        sleep 1
        deno run --allow-all --unstable-sloppy-imports tests/e2e/auto-test.ts --only=sign
        ;;
    "rotation")
        echo "🔄 Running rotation test..."
        sleep 1
        deno run --allow-all --unstable-sloppy-imports tests/e2e/auto-test.ts --only=rotation
        ;;
    "clean")
        echo "🧹 Cleaning storage..."
        deno run --allow-all --unstable-sloppy-imports tests/e2e/party.ts clear
        ;;
    "help"|"h"|"-h"|"--help")
        echo ""
        echo "Usage: ./test.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  quick, q          Run quick 2-of-2 test (default)"
        echo "  auto, a [opts]    Run full automated test with options"
        echo "  setup             Run setup only"
        echo "  keygen            Run keygen test only"
        echo "  sign              Run signing test only" 
        echo "  rotation          Run rotation test only"
        echo "  clean             Clean all storage"
        echo "  help, h           Show this help"
        echo ""
        echo "Auto test options (use with 'auto'):"
        echo "  --threshold=N     Set threshold (default: 2)"
        echo "  --parties=N       Set total parties (default: 2)"
        echo "  --timeout=N       Set timeout in seconds (default: 60)"
        echo "  --clean           Clean storage before starting"
        echo "  --skip-setup      Skip setup step"
        echo "  --skip-keygen     Skip keygen step"
        echo "  --skip-sign       Skip signing step"
        echo "  --skip-rotation   Skip rotation step"
        echo ""
        echo "Examples:"
        echo "  ./test.sh                           # Quick 2-of-2 test"
        echo "  ./test.sh auto                      # Full automated test"
        echo "  ./test.sh auto --threshold=3 --parties=5  # 3-of-5 test"
        echo "  ./test.sh auto --clean              # Clean start"
        echo "  ./test.sh keygen                    # Only keygen"
        echo "  ./test.sh sign                      # Only signing"
        echo ""
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Use './test.sh help' for usage information"
        exit 1
        ;;
esac
