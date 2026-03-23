const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    target: 'web',
    mode: isProduction ? 'production' : 'development',
    
    entry: './src/app.js', 
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js', 
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
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
        } : false,
      }),
    ],

    devtool: isProduction ? false : 'eval-source-map',

    devServer: {
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
