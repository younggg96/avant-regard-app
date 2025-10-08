# 集成 react-native-image-crop-picker

## 安装步骤

### 1. 安装包
```bash
npm install react-native-image-crop-picker
# 或
yarn add react-native-image-crop-picker
```

### 2. iOS 配置
```bash
cd ios && pod install
```

在 `ios/YourProject/Info.plist` 添加权限：
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>$(PRODUCT_NAME) 需要访问您的相册来选择图片</string>
<key>NSCameraUsageDescription</key>
<string>$(PRODUCT_NAME) 需要访问相机来拍摄照片</string>
```

### 3. Android 配置
在 `android/app/build.gradle` 中：
```gradle
android {
    ...
    
    // 添加这个配置
    packagingOptions {
        pickFirst 'lib/x86/libc++_shared.so'
        pickFirst 'lib/x86_64/libc++_shared.so'
        pickFirst 'lib/arm64-v8a/libc++_shared.so'
        pickFirst 'lib/armeabi-v7a/libc++_shared.so'
    }
}
```

## 在 PublishScreen 中使用

替换现有的 ImageCropper 组件：

```typescript
// src/screens/PublishScreen.tsx

import ImagePicker from 'react-native-image-crop-picker';

// 选择并裁剪图片
const handleSelectImage = () => {
  ImagePicker.openPicker({
    width: 1080,
    height: 1080,
    cropping: true,
    cropperToolbarTitle: '裁剪图片',
    cropperActiveWidgetColor: '#000000',
    cropperStatusBarColor: '#000000',
    cropperToolbarColor: '#000000',
    cropperToolbarWidgetColor: '#FFFFFF',
    freeStyleCropEnabled: true, // 自由裁剪
    aspectRatioPickerButtonHidden: false, // 显示比例选择
    cropperChooseText: '选择',
    cropperCancelText: '取消',
    compressImageQuality: 0.9,
  }).then(image => {
    console.log('裁剪后的图片:', image);
    // image.path 是裁剪后的图片路径
    handleImageCropped(image.path);
  }).catch(error => {
    console.log('取消选择或错误:', error);
  });
};

// 直接裁剪已有图片
const cropExistingImage = (imagePath: string) => {
  ImagePicker.openCropper({
    path: imagePath,
    width: 1080,
    height: 1080,
    cropping: true,
    freeStyleCropEnabled: true,
    cropperToolbarTitle: '裁剪图片',
    cropperActiveWidgetColor: '#000000',
    compressImageQuality: 0.9,
  }).then(image => {
    console.log('裁剪完成:', image);
    // 更新图片
    updateImage(image.path);
  });
};

// 从相机拍摄并裁剪
const handleCamera = () => {
  ImagePicker.openCamera({
    width: 1080,
    height: 1080,
    cropping: true,
    cropperToolbarTitle: '裁剪照片',
    compressImageQuality: 0.9,
  }).then(image => {
    console.log('拍摄并裁剪:', image);
    handleImageCropped(image.path);
  });
};
```

## 高级配置选项

### 圆形裁剪
```typescript
ImagePicker.openCropper({
  path: imagePath,
  width: 300,
  height: 300,
  cropperCircleOverlay: true, // 启用圆形裁剪
  cropping: true,
});
```

### 固定比例裁剪
```typescript
ImagePicker.openCropper({
  path: imagePath,
  width: 400,
  height: 300,
  cropping: true,
  freeStyleCropEnabled: false, // 禁用自由裁剪
  aspectRatioPickerButtonHidden: true, // 隐藏比例选择按钮
});
```

### 批量选择（不裁剪）
```typescript
ImagePicker.openPicker({
  multiple: true,
  maxFiles: 9,
  mediaType: 'photo',
}).then(images => {
  console.log('选择的图片列表:', images);
});
```

## 返回数据结构

```typescript
interface ImagePickerResponse {
  path: string;           // 图片本地路径
  width: number;         // 裁剪后宽度
  height: number;        // 裁剪后高度
  mime: string;          // MIME 类型
  size: number;          // 文件大小（字节）
  data?: string;         // Base64 数据（如果 includeBase64: true）
  exif?: object;         // EXIF 信息（如果 includeExif: true）
  cropRect?: {           // 裁剪区域信息
    x: number;
    y: number;
    width: number;
    height: number;
  };
  creationDate?: string; // 创建时间
  modificationDate?: string; // 修改时间
}
```

## 性能优化建议

1. **压缩质量**：设置 `compressImageQuality: 0.8` 平衡质量和大小
2. **尺寸限制**：设置合理的 `width` 和 `height` 避免内存溢出
3. **清理临时文件**：
```typescript
ImagePicker.clean().then(() => {
  console.log('清理临时文件成功');
}).catch(e => {
  console.log('清理失败', e);
});
```

## 与现有代码集成

如果要保留自定义裁剪界面作为备选方案：

```typescript
const [useNativeCropper, setUseNativeCropper] = useState(true);

const handleImageEdit = (imageUri: string) => {
  if (useNativeCropper) {
    // 使用原生裁剪器
    ImagePicker.openCropper({
      path: imageUri,
      width: 1080,
      height: 1080,
      cropping: true,
    }).then(image => {
      onImageCropped(image.path);
    });
  } else {
    // 使用自定义裁剪器
    setShowImageCropper(true);
    setSelectedImageUri(imageUri);
  }
};
```

## 优势对比

### react-native-image-crop-picker
✅ **优点**：
- 原生性能，流畅度高
- 功能完整，包含选择、拍摄、裁剪
- 社区活跃，问题解决快
- 支持多种裁剪模式

⚠️ **缺点**：
- UI 定制性有限
- 需要原生配置
- 增加应用包大小

### 自定义 ImageCropper 组件
✅ **优点**：
- UI 完全可控
- 纯 JS 实现，易于调试
- 可以添加特殊功能

⚠️ **缺点**：
- 性能不如原生
- 需要维护更多代码
- 手势处理复杂

## 推荐

对于生产环境，建议使用 **react-native-image-crop-picker**，因为：
1. 稳定性经过大量项目验证
2. 性能优秀
3. 用户体验接近原生应用
4. 维护成本低

如果需要特殊的裁剪功能或 UI，可以保留自定义组件作为补充。
