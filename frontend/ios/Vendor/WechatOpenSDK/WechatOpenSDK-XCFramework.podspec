Pod::Spec.new do |s|
  s.name             = 'WechatOpenSDK-XCFramework'
  s.version          = '2.0.5'
  s.summary          = 'WeChat OpenSDK XCFramework, vendored locally to bypass dldir1.qq.com unreachable from overseas CI (EAS Build).'
  s.homepage         = 'https://mp.weixin.qq.com'
  s.license          = { :type => 'Copyright', :text => "Copyright 2020 tencent.com. All rights reserved.\n" }
  s.authors          = { 'tencent' => 'weixin-open@qq.com' }
  s.platforms        = { :ios => '12.0' }
  s.source           = { :path => '.' }
  s.requires_arc     = false
  s.vendored_frameworks = 'WechatOpenSDK.xcframework'
  s.frameworks       = ['Security', 'UIKit', 'CoreGraphics', 'WebKit']
  s.libraries        = ['z', 'sqlite3.0', 'c++']
  s.pod_target_xcconfig = { 'VALID_ARCHS' => 'arm64 x86_64' }
  s.user_target_xcconfig = { 'VALID_ARCHS' => 'arm64 x86_64' }
end
