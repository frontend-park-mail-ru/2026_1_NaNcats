const path = require('path');
const dotenv = require('dotenv');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const env = dotenv.config().parsed || {};
const envKeys = Object.keys(env).reduce((prev, next) => {
    prev[`process.env.${next}`] = JSON.stringify(env[next]);
    return prev;
}, {});

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    target: 'web',
    mode: isProduction ? 'production' : 'development',
    
    entry: './src/app.ts', 

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js', 
      publicPath: '/',
      clean: true,
    },

    resolve: {
      extensions: ['.ts', '.js', '.json'], 
    },

    module: {
      rules: [
        {
          test: /\.(css|scss)$/i,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.(js|ts)$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
        } : false,
        templateParameters: {
          yandexKey: process.env.YANDEX_JS_KEY,
      }
      }),
      new webpack.DefinePlugin(envKeys)
    ],

    devtool: isProduction ? false : 'eval-source-map',

    devServer: {
      server: {
        type: 'https',
        options: {
          key: './localhost+1-key.pem',
          cert: './localhost+1.pem',
        },
      },
      port: 2033,
      hot: false, 
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
};
