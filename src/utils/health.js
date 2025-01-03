const os = require('os');
const process = require('process');

class HealthCheck {
    constructor() {
        this.startTime = Date.now();
    }

    getUptime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    getMemoryUsage() {
        const used = process.memoryUsage();
        return {
            heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),   // MB
            rss: Math.round(used.rss / 1024 / 1024),             // MB
            memoryUsage: Math.round((used.heapUsed / used.heapTotal) * 100) // %
        };
    }

    getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cpuUsage: Math.round(os.loadavg()[0] * 100) / 100,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
            freeMemory: Math.round(os.freemem() / 1024 / 1024)    // MB
        };
    }

    async checkTMDBConnection(tmdbClient) {
        try {
            const startTime = Date.now();
            await tmdbClient.makeRequest('GET', '/configuration');
            const endTime = Date.now();
            return {
                status: 'ok',
                responseTime: endTime - startTime
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        const remainingSeconds = seconds % 60;

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

        return parts.join(' ');
    }

    async getFullHealth(tmdbClient) {
        const uptime = this.getUptime();
        const tmdbStatus = await this.checkTMDBConnection(tmdbClient);
        const memory = this.getMemoryUsage();
        const system = this.getSystemInfo();

        return {
            status: tmdbStatus.status === 'ok' ? 'healthy' : 'unhealthy',
            version: process.env.npm_package_version || '1.0.0',
            uptime: {
                seconds: uptime,
                formatted: this.formatUptime(uptime)
            },
            tmdb: {
                status: tmdbStatus.status,
                responseTime: tmdbStatus.responseTime,
                error: tmdbStatus.error
            },
            memory: {
                ...memory,
                system: {
                    total: system.totalMemory,
                    free: system.freeMemory,
                    usage: Math.round(((system.totalMemory - system.freeMemory) / system.totalMemory) * 100)
                }
            },
            system: {
                platform: system.platform,
                arch: system.arch,
                nodeVersion: system.nodeVersion,
                cpuUsage: system.cpuUsage
            },
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new HealthCheck();
