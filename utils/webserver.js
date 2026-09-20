// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = 'development';
process.env.ASSET_PATH = '/';

const path = require('path');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const config = require('../webpack.config');
const env = require('./env');

// MV3 forbids loading remote script, so there is no HMR client to inject —
// the dev server just rebuilds into build/ on every save (`writeToDisk`).
// Reopen the popup to pick up a change; hit "Reload" on chrome://extensions
// only when the manifest or the service worker changed.
const compiler = webpack(config);

const server = new WebpackDevServer(
  {
    hot: false,
    liveReload: false,
    client: false,
    host: 'localhost',
    port: env.PORT,
    static: { directory: path.join(__dirname, '../build') },
    devMiddleware: {
      publicPath: `http://localhost:${env.PORT}/`,
      writeToDisk: true,
    },
    headers: { 'Access-Control-Allow-Origin': '*' },
    allowedHosts: 'all',
  },
  compiler
);

(async () => {
  await server.start();
  console.log(
    `Watching. Output is written to ${path.join(__dirname, '../build')}`
  );
})();
