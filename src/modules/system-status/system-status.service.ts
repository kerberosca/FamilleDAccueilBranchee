import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { statfs } from "node:fs/promises";
import os from "node:os";

type DiskStatus = {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
};

type CpuSnapshot = {
  idle: number;
  total: number;
};

@Injectable()
export class SystemStatusService {
  constructor(private readonly configService: ConfigService) {}

  async getStatus() {
    const [cpuUsagePercent, rootDisk, uploadsDisk] = await Promise.all([
      this.sampleCpuUsagePercent(),
      this.getDiskStatus("/"),
      this.getDiskStatus(this.getUploadsPath())
    ]);
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const usedMemoryBytes = Math.max(0, totalMemoryBytes - freeMemoryBytes);

    return {
      generatedAt: new Date().toISOString(),
      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        uptimeSeconds: Math.round(os.uptime())
      },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        pid: process.pid,
        memory: process.memoryUsage()
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model ?? "unknown",
        loadAverage: os.loadavg(),
        usagePercent: cpuUsagePercent
      },
      memory: {
        totalBytes: totalMemoryBytes,
        freeBytes: freeMemoryBytes,
        usedBytes: usedMemoryBytes,
        usedPercent: this.percent(usedMemoryBytes, totalMemoryBytes)
      },
      disk: {
        root: rootDisk,
        uploads: uploadsDisk
      },
      scope: "os-visible-from-api-container"
    };
  }

  private getUploadsPath(): string {
    return this.configService.get<string>("RESOURCE_DOCUMENTS_DIR", "/app/private/uploads/resource-documents");
  }

  private async getDiskStatus(path: string): Promise<DiskStatus | null> {
    try {
      const stats = await statfs(path);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      return {
        path,
        totalBytes,
        freeBytes,
        usedBytes,
        usedPercent: this.percent(usedBytes, totalBytes)
      };
    } catch {
      return null;
    }
  }

  private async sampleCpuUsagePercent(): Promise<number> {
    const start = this.cpuSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const end = this.cpuSnapshot();
    const idle = end.idle - start.idle;
    const total = end.total - start.total;
    if (total <= 0) {
      return 0;
    }
    return this.round(Math.max(0, Math.min(100, ((total - idle) / total) * 100)));
  }

  private cpuSnapshot(): CpuSnapshot {
    return os.cpus().reduce(
      (acc, cpu) => {
        const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
        return {
          idle: acc.idle + cpu.times.idle,
          total: acc.total + total
        };
      },
      { idle: 0, total: 0 }
    );
  }

  private percent(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }
    return this.round((value / total) * 100);
  }

  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
