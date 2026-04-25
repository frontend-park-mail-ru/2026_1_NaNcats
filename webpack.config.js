// webpack.config.js
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

dotenv.config();

const envFromFile = dotenv.config().parsed || {};
const envKeys = Object.keys(envFromFile).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(envFromFile[next]);
  return prev;
}, {});

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  // ВАЖНО: для HTTPS devServer нужны реальные PEM
  const httpsKeyPath = path.resolve(__dirname, "localhost+1-key.pem");
  const httpsCertPath = path.resolve(__dirname, "localhost+1.pem");

  const devServerHttpsOptions =
    fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)
      ? {
          key: fs.readFileSync(httpsKeyPath),
          cert: fs.readFileSync(httpsCertPath),
        }
      : undefined;

  return {
    target: "web",
    mode: isProduction ? "production" : "development",

    entry: {
      app: "./src/app.ts",
      sw: "./src/sw.ts",
      support: "./src/support/index.ts",
    },

    output: {
      path: path.resolve(__dirname, "dist"),
      filename: (pathData) => {
        if (pathData.chunk.name === "sw") return "sw.js";
        return isProduction ? "[name].[contenthash].js" : "[name].js";
      },
      publicPath: "/",
      clean: true,
    },

    resolve: {
      extensions: [".ts", ".js", ".json"],
    },

    module: {
      rules: [
        {
          test: /\.(css|scss)$/i,
          use: ["style-loader", "css-loader", "sass-loader"],
        },
        {
          test: /\.(js|ts)$/,
          use: "babel-loader",
          exclude: /node_modules/,
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        chunks: ["app"],
        minify: isProduction
          ? { removeComments: true, collapseWhitespace: true }
          : false,
        templateParameters: {
          yandexKey: process.env.YANDEX_JS_KEY,
        },
      }),

      new HtmlWebpackPlugin({
        filename: "support.html",
        template: "./public/support.html",
        chunks: ["support"],
        minify: isProduction
          ? { removeComments: true, collapseWhitespace: true }
          : false,
      }),

      new webpack.DefinePlugin(envKeys),
    ],

    devtool: isProduction ? false : "eval-source-map",

    devServer: {

      server: devServerHttpsOptions
        ? { type: "https", options: devServerHttpsOptions }
        : { type: "http" },

      port: 2033,
      hot: false,
      liveReload: true,
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, "public"),
      },
      client: {
        overlay: true,
      },
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      ],
    },
  };
};
