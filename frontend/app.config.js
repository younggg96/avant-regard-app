const IS_NA = process.env.APP_VARIANT === "na";

const config = {
  name: IS_NA ? "Avant Regard NA" : "Avant Regard",
  slug: "avant-regard",
  version: "1.3.3",
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
    buildNumber: "35",
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
    // Stripe React Native config plugin
    // - merchantIdentifier 在 Apple Developer Portal 创建,启用 Apple Pay 必填;
    //   留空时 Apple Pay 走不通(收单依然可以,降级走 Card)。
    // - enableGooglePay=true 在 Android 上启用 Google Pay 收单。
    // 真正接入 Apple/Google Pay 还需要 PaymentSheet 配置 applePay/googlePay 选项,
    // 这里仅提供原生侧的能力声明。
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier: "merchant.com.yanggg96.avant-regard",
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
