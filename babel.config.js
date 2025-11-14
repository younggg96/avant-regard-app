// babel.config.js
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // 如果你需要 gluestack，可以把下面这行取消注释
      // "@gluestack-style/babel-plugin-styled-resolver",

      // ⚠️ 一定要放在最后
      "react-native-reanimated/plugin",
    ],
    // 用 overrides 控制：只对非 react-native-maps 的文件使用私有字段相关插件
    overrides: [
      {
        // 对所有文件生效...
        test: (filename) =>
          !!filename && !filename.includes("node_modules/react-native-maps"),
        // ...但排除掉 react-native-maps
        plugins: [
          ["@babel/plugin-transform-private-methods", { loose: true }],
          [
            "@babel/plugin-transform-private-property-in-object",
            { loose: true },
          ],
        ],
      },
    ],
  };
};
