/**
 * PM2 config untuk self-host di VPS (opsional, gratis & open-source).
 *   npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save
 * Server akan build dulu (npm run start) lalu listen di PORT.
 */
module.exports = {
  apps: [
    {
      name: 'cilegon-enggih',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        BIND_HOST: '0.0.0.0'
      }
    }
  ]
};
