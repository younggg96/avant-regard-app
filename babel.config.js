module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Support for private methods and properties (ES2022 features)
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
      // gluestack-ui babel plugin
      // "@gluestack-style/babel-plugin-styled-resolver",
      // Keep reanimated plugin last
      "react-native-reanimated/plugin",
    ],
  };
};
