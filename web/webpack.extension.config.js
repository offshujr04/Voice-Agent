const path = require('path');
const webpack = require('webpack');

// Builds the Chrome-extension content script that injects the voice widget on
// any site. Output goes into ../extension so the unpacked extension is ready to
// load. Mirrors webpack.config.js (the <script> embed build) but with a
// different entry/output.
module.exports = {
  mode: 'production',
  entry: './extension-src/content-entry.tsx',
  output: {
    path: path.resolve(__dirname, '..', 'extension'),
    filename: 'content.js',
  },
  devtool: false,
  plugins: [
    // A content script runs in an isolated world with no Node `process` global,
    // so any surviving `process.env.X` reference throws ReferenceError at runtime
    // (which silently aborts the token fetch). The embed build relies on the
    // Dotenv plugin for this; here we replace the one var the widget reads at
    // runtime. Default to `undefined` so the `?? '/api/connection-details'`
    // fallback in use-connection-details.ts applies (the extension targets its
    // own origin via window.__lkApiBase + that relative path).
    new webpack.DefinePlugin({
      'process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT': process.env
        .NEXT_PUBLIC_CONN_DETAILS_ENDPOINT
        ? JSON.stringify(process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT)
        : 'undefined',
    }),
  ],
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
