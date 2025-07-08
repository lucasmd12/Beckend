const path = require('path');
const SentryWebpackPlugin = require('@sentry/webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './server.js',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'server.js',
  },
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  externals: {
    // Excluir módulos nativos do Node.js do bundle
    'express': 'commonjs express',
    'mongoose': 'commonjs mongoose',
    'socket.io': 'commonjs socket.io',
    'redis': 'commonjs redis',
    'winston': 'commonjs winston',
    '@sentry/node': 'commonjs @sentry/node',
    '@sentry/tracing': 'commonjs @sentry/tracing',
  },
  plugins: [
    // Plugin do Sentry para upload de Source Maps em produção
    ...(process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN ? [
      new SentryWebpackPlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        include: './dist',
        ignore: ['node_modules', 'webpack.config.js'],
        release: process.env.npm_package_version || '1.0.0',
        deploy: {
          env: process.env.NODE_ENV || 'production',
        },
      })
    ] : [])
  ],
  resolve: {
    extensions: ['.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  node: '16'
                }
              }]
            ]
          }
        }
      }
    ]
  }
};

