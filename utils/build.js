// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = 'production';
process.env.ASSET_PATH = '/';

const webpack = require('webpack');
const config = require('../webpack.config');

config.mode = 'production';

webpack(config, function (err, stats) {
  // `err` only covers webpack itself blowing up; compilation errors (a broken
  // loader, a type error) live on `stats`. Reporting only `err` is how this
  // build used to "succeed" while emitting nothing.
  if (err) {
    console.error(err.stack || err);
    if (err.details) console.error(err.details);
    process.exit(1);
  }

  console.log(
    stats.toString({
      colors: true,
      modules: false,
      chunks: false,
      children: false,
    })
  );

  if (stats.hasErrors()) process.exit(1);
});
