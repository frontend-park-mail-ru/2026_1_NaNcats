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
    
    entry: {
      app: './src/app/index.ts',
      sw: './src/sw.ts' 
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: (pathData) => {
        return pathData.chunk.name === 'sw' 
          ? 'sw.js' 
          : (isProduction ? '[name].[contenthash].js' : '[name].js');
      }, 
      publicPath: '/',
      clean: true,
    },

    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@app': path.resolve(__dirname, 'src/app'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@widgets': path.resolve(__dirname, 'src/widgets'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@entities': path.resolve(__dirname, 'src/entities'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
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
        excludeChunks: ['sw'],
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
