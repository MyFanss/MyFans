import { ChainEventReplayRunner, ReplayOptions } from '../indexer/replay/chain-event-replay.runner';
import { HorizonChainEventSource } from '../indexer/replay/horizon-chain-event.source';
import { PostgresChainEventStore } from '../indexer/replay/postgres-chain-event.store';

interface CliArgs {
  startCursor: string;
  endCursor?: string;
  dryRun: boolean;
  limit: number;
}

function readArg(args: string[], key: string): string | undefined {
  const index = args.findIndex((arg) => arg === key);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseArgs(argv: string[]): CliArgs {
  const startCursor = readArg(argv, '--start-cursor');
  if (!startCursor) {
    throw new Error('Missing required argument: --start-cursor <cursor>');
  }

  const endCursor = readArg(argv, '--end-cursor');
  const limitRaw = readArg(argv, '--limit');
  const dryRun = argv.includes('--dry-run');

  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 200;
  if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
    throw new Error('Invalid --limit value. Expected an integer between 1 and 200.');
  }

  return {
    startCursor,
    endCursor,
    dryRun,
    limit,
  };
}

function printUsage(): void {
  // Keep this concise for operators running incidents.
  console.log(
    [
      'Usage:',
      '  npm run replay:chain-events -- --start-cursor <cursor> [--end-cursor <cursor>] [--dry-run] [--limit 200]',
      '',
      'Environment:',
      '  DATABASE_URL       PostgreSQL DSN for replay storage (required)',
      '  HORIZON_URL        Horizon base URL (default: https://horizon-testnet.stellar.org)',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required.');
    }

    const horizonUrl =
      process.env.HORIZON_URL?.trim() || 'https://horizon-testnet.stellar.org';

    const source = new HorizonChainEventSource(horizonUrl);
    const store = new PostgresChainEventStore(databaseUrl);
    const runner = new ChainEventReplayRunner(source, store);

    const replayOptions: ReplayOptions = {
      startCursor: args.startCursor,
      endCursor: args.endCursor,
      dryRun: args.dryRun,
      limit: args.limit,
    };

    const summary = await runner.replay(replayOptions);

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    printUsage();
    process.exitCode = 1;
  }
}

void main();
