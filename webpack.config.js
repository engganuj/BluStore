const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
  ...defaultConfig,
  entry: {
    'blu-admin': path.resolve(__dirname, 'src/index.jsx'),
  },
  output: {
    ...defaultConfig.output,
    path: path.resolve(__dirname, 'admin/build'),
    filename: '[name].js',
  },
};
