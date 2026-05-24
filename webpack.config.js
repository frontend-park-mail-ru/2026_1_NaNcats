const path = require('path');
const dotenv = require('dotenv');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');

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
      app: './src/app/index.tsx',
      sw: './src/sw.ts'
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: (pathData) => {
        return pathData.chunk.name === 'sw'
          ? 'sw.js'
          : (isProduction ? '[name].[contenthash].js' : '[name].js');
      },
      chunkFilename: isProduction ? '[name].[contenthash].js' : '[name].js',
      // Images: use content hash for long-term caching
      assetModuleFilename: isProduction
        ? 'assets/[name].[contenthash][ext]'
        : 'assets/[name][ext]',
      publicPath: '/',
      clean: true,
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json'],
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
          use: [
            // In production: extract CSS into separate file for minification & caching
            // In development: inject styles at runtime for fast HMR
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.(js|ts|tsx)$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          // Handle image imports as asset modules (webpack 5 built-in)
          test: /\.(png|jpe?g|gif|svg|webp|ico)$/i,
          type: 'asset/resource',
        },
      ],
    },

    optimization: {
      minimizer: [
        // JS minification is handled by TerserPlugin (webpack default in prod)
        '...',
        // CSS minification
        new CssMinimizerPlugin(),
        // Image minification (uses sharp)
        new ImageMinimizerPlugin({
          minimizer: {
            implementation: ImageMinimizerPlugin.sharpMinify,
            options: {
              encodeOptions: {
                // Rasterize with high quality
                jpeg: { quality: 85 },
                webp: { quality: 85 },
                png: { quality: 85 },
                gif: {},
              },
            },
          },
          // Convert raster images to WebP for modern browsers
          generator: [
            {
              preset: 'webp',
              implementation: ImageMinimizerPlugin.sharpGenerate,
              options: {
                encodeOptions: {
                  webp: { quality: 85 },
                },
              },
            },
          ],
        }),
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        excludeChunks: ['sw'],
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
        } : false,
        templateParameters: {
          yandexKey: process.env.YANDEX_JS_KEY,
        }
      }),

      new webpack.DefinePlugin(envKeys),

      // Extract CSS into a separate file in production (enables caching & minification)
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: '[name].[contenthash].css',
          chunkFilename: '[name].[contenthash].css',
        }),

        // Pre-compress assets with gzip (nginx uses these via gzip_static on)
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 1024,  // Only compress files > 1 KB
          minRatio: 0.8,
        }),
      ] : []),
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
          ws: true,
          onError(err, req, res) {
            if (err && (err.code === 'EPIPE' || err.code === 'ECONNRESET')) return;
            console.warn('[proxy] error:', err && err.message);
          },
        },
      ],
    },
  };
};
