const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  target: 'web', 
  mode: 'development',
  
  entry: './src/app.js', 
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js', 
    publicPath: '/',
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new webpack.HotModuleReplacementPlugin(),
  ],

  devServer: {
    port: 2033,
    hot: true, 
    liveReload: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
    },
    client: {
      overlay: true, 
    },
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    ],
  },
};
