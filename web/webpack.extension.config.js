const path = require('path');

// Builds the Chrome-extension content script that injects the voice widget on
// any site. Output goes into ../extension so the unpacked extension is ready to
// load. Mirrors webpack.config.js (the <script> embed build) but with a
// different entry/output and no env injection (config comes from chrome.storage).
module.exports = {
  mode: 'production',
  entry: './extension-src/content-entry.tsx',
  output: {
    path: path.resolve(__dirname, '..', 'extension'),
    filename: 'content.js',
  },
  devtool: false,
  resolve: {
    alias: { '@': path.resolve(__dirname) },
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: { loader: 'ts-loader', options: { configFile: 'tsconfig.webpack.json' } },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['css-loader', 'postcss-loader'],
        exclude: /node_modules/,
      },
    ],
  },
};
