const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const env = require('./utils/env');

const ASSET_PATH = process.env.ASSET_PATH || '/';

const alias = {};

// load the secrets
const secretsPath = path.join(__dirname, 'secrets.' + env.NODE_ENV + '.js');
if (fs.existsSync(secretsPath)) {
  alias['secrets'] = secretsPath;
}

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

// Each extension page: entry chunk + the HTML template it is injected into.
const pages = [
  { name: 'popup', dir: 'Popup' },
  { name: 'backup', dir: 'Backup' },
];

const options = {
  mode: env.NODE_ENV,
  entry: {
    ...Object.fromEntries(
      pages.map((p) => [
        p.name,
        path.join(__dirname, 'src', 'pages', p.dir, 'index.tsx'),
      ])
    ),
    background: path.join(__dirname, 'src', 'pages', 'Background', 'index.ts'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'build'),
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        use: [
          'style-loader',
          'css-loader',
          { loader: 'sass-loader', options: { sourceMap: true } },
        ],
      },
      {
        test: new RegExp('.(' + fileExtensions.join('|') + ')$'),
        type: 'asset/resource',
        exclude: /node_modules/,
      },
      { test: /\.tsx?$/, loader: 'ts-loader', exclude: /node_modules/ },
    ],
  },
  resolve: {
    alias,
    extensions: fileExtensions
      .map((extension) => '.' + extension)
      .concat(['.js', '.ts', '.tsx', '.css']),
  },
  plugins: [
    new webpack.ProgressPlugin(),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: path.join(__dirname, 'build'),
          force: true,
          transform: (content) =>
            Buffer.from(
              JSON.stringify({
                description: process.env.npm_package_description,
                version: process.env.npm_package_version,
                ...JSON.parse(content.toString()),
              })
            ),
        },
        {
          from: 'src/assets/img/icon-128.png',
          to: path.join(__dirname, 'build'),
          force: true,
        },
        {
          from: 'src/assets/img/icon-34.png',
          to: path.join(__dirname, 'build'),
          force: true,
        },
      ],
    }),
    ...pages.map(
      (p) =>
        new HtmlWebpackPlugin({
          template: path.join(__dirname, 'src', 'pages', p.dir, 'index.html'),
          filename: `${p.name}.html`,
          chunks: [p.name],
          cache: false,
        })
    ),
    // The block page is plain HTML with no bundle of its own.
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'pages', 'Blocked', 'index.html'),
      filename: 'blocked.html',
      chunks: [],
      cache: false,
    }),
  ],
  infrastructureLogging: {
    level: 'info',
  },
};

if (env.NODE_ENV === 'development') {
  options.devtool = 'cheap-module-source-map';
} else {
  options.optimization = {
    minimize: true,
    minimizer: [new TerserPlugin({ extractComments: false })],
  };
}

module.exports = options;
