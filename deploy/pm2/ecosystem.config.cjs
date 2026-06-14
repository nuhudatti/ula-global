/** PM2 process config — Node binds localhost only; Nginx terminates TLS. */

module.exports = {

  apps: [

    {

      name: 'ula',

      cwd: '/var/www/ibbul-ula',

      script: 'npm',

      args: 'start',

      env: {

        NODE_ENV: 'production',

        HOST: '127.0.0.1',

        PORT: 4000,

      },

      instances: 1,

      exec_mode: 'fork',

      max_memory_restart: '512M',

      error_file: '/var/log/ula/pm2-error.log',

      out_file: '/var/log/ula/pm2-out.log',

      merge_logs: true,

      time: true,

      autorestart: true,

      watch: false,

      /** Avoid rapid crash loops when .env is misconfigured — backoff between restarts. */

      max_restarts: 8,

      min_uptime: 5000,

      restart_delay: 10000,

      exp_backoff_restart_delay: 200,

    },

  ],

};

