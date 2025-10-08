#!/usr/bin/env node

/**
 * Bot Health Monitor
 * Simple script to monitor your Discord bot's health status
 * Run this to check if your bot is online and responding
 */

const fetch = require('node-fetch');

const BOT_URL = process.env.BOT_URL || 'http://localhost:3000';

async function checkBotHealth() {
    try {
        console.log('🔍 Checking bot health...');
        console.log(`📡 URL: ${BOT_URL}/health`);
        
        const response = await fetch(`${BOT_URL}/health`, {
            timeout: 10000
        });
        
        if (!response.ok) {
            console.log(`❌ Bot returned status: ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        
        console.log('✅ Bot Health Check Results:');
        console.log(`   Status: ${data.status}`);
        console.log(`   Discord: ${data.discord.status}`);
        console.log(`   Guilds: ${data.discord.guilds}`);
        console.log(`   Ping: ${data.discord.ping}ms`);
        console.log(`   Uptime: ${Math.round(data.uptime / 60)} minutes`);
        console.log(`   Memory: ${data.memory.heapUsed}MB used`);
        console.log(`   Reconnect Attempts: ${data.reconnectAttempts}`);
        
        if (data.status === 'online' && data.discord.status === 'connected') {
            console.log('🎉 Bot is healthy and online!');
            return true;
        } else {
            console.log('⚠️ Bot appears to have issues');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Failed to check bot health:', error.message);
        return false;
    }
}

// Run health check
checkBotHealth().then(success => {
    process.exit(success ? 0 : 1);
});
