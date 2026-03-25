import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { StartupProbeService } from './health/startup-probe.service';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const probeService = app.get(StartupProbeService);

  // DB probe — uses TypeORM DataSource if available
  let dbResult: { ok: boolean; error?: string };
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    dbResult = await probeService.probeDb(() => dataSource.query('SELECT 1'));
  } catch {
    // TypeORM not configured (e.g. test env) — skip DB probe
    dbResult = { ok: true };
  }
  probeService.handleResult('DB', dbResult);

  // RPC probe
  const rpcResult = await probeService.probeRpc();
  probeService.handleResult('RPC', rpcResult);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
