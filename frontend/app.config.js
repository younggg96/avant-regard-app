const IS_NA = process.env.APP_VARIANT === "na";

const config = {
  name: IS_NA ? "Avant Regard NA" : "Avant Regard",
  slug: "avant-regard",
  version: "1.4.1",
  orientation: "portrait",
  icon: "./assets/images/logo.jpg",
  userInterfaceStyle: "automatic",
  scheme: IS_NA ? "avantregardna" : "avantregard",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "Avant Regard needs access to your photo library so you can select photos or videos to publish outfit shares, product reviews, or update your profile picture and cover image.",
      NSCameraUsageDescription:
        "Avant Regard needs to use your camera so you can take outfit photos for publishing posts, such as capturing your outfit of the day to share with the community.",
      NSPhotoLibraryAddUsageDescription:
        "Avant Regard needs to save your edited images or shared content posters to your photo library.",
      NSLocationWhenInUseUsageDescription:
        "Avant Regard needs your location to show nearby buyer stores on the map, such as finding designer brand concept stores near you.",
      ITSAppUsesNonExemptEncryption: false,
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsLocalNetworking: true,
      },
      ...(IS_NA
        ? {}
        : {
            LSApplicationQueriesSchemes: [
              "weixin",
              "weixinULAPI",
              "sinaweibo",
              "sinaweibohd",
            ],
          }),
    },
    bundleIdentifier: IS_NA
      ? "com.yanggg96.avant-regard.na"
      : "com.yanggg96.avant-regard",
    buildNumber: "36",
    associatedDomains: ["applinks:app.avantregard.com"],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/logo.jpg",
      backgroundColor: "#000000",
    },
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
    ],
    package: IS_NA ? "com.yanggg96.avantregard.na" : "com.yanggg96.avantregard",
    versionCode: 1,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "app.avantregard.com",
            pathPrefix: "/post",
          },
          {
            scheme: "https",
            host: "app.avantregard.com",
            pathPrefix: "/share",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/images/logo.jpg",
  },
  plugins: [
    "expo-apple-authentication",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/splash.png",
        resizeMode: "contain",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#000000",
        sounds: [],
        defaultChannel: "default",
      },
    ],
    "expo-video",
    // 这里刻意不挂 "expo-media-library" 插件。
    //
    // 该插件只做两件事：往 infoPlist 写 NSPhotoLibrary{,Add}UsageDescription，
    // 往 Android 加 READ/WRITE_EXTERNAL_STORAGE —— 这四项上面都已手写声明，
    // 挂上去纯属重复。原生模块本身走 autolinking，不依赖这个插件。
    //
    // 而且挂上会直接让 prebuild 失败：npm workspaces 把 expo-media-library
    // 提升到了仓库根 node_modules，但 expo 本体在 frontend/node_modules，
    // 插件内部 require("expo/config-plugins") 从根目录解析不到。
    // （expo-secure-store 同样被提升却没事，因为它 require 的是独立包
    //   "@expo/config-plugins"，那个在根目录。）
    // Stripe React Native config plugin
    // merchantIdentifier 先不写。EAS 上现有的 App Store 描述文件没有 Apple Pay
    // capability，写了这次 TestFlight 会在签名阶段直接失败。银行卡收单不依赖它。
    // 要开 Apple Pay 时，先在描述文件里加上 merchant.com.yanggg96.avant-regard 再填回来。
    [
      "@stripe/stripe-react-native",
      {
        enableGooglePay: true,
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "3e890188-f159-4285-81fb-790e46fce869",
    },
  },
};

export default { expo: config };
