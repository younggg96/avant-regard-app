module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Support for private methods and properties (ES2022 features)
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
      // Keep reanimated plugin last
      "react-native-reanimated/plugin",
    ],
  };
};
