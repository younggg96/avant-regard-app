# 图片裁剪器边界约束修复

## 问题描述

裁剪框在拖动时会超出图片边界，特别是在使用固定比例时。

## 根本原因

在 `react-native-reanimated` 的 worklet 中不能直接访问 React state (`imageDimensions`)。Worklets 运行在 UI 线程上，无法访问 JavaScript 线程上的 React state。

## 解决方案

### 1. 引入 Shared Values

创建专门的 shared values 来存储图片边界信息：

```typescript
// Shared values for image bounds (for use in worklets)
const imageBoundsX = useSharedValue(0);
const imageBoundsY = useSharedValue(0);
const imageBoundsWidth = useSharedValue(SCREEN_WIDTH);
const imageBoundsHeight = useSharedValue(SCREEN_HEIGHT);
```

### 2. 同步更新 Shared Values

在图片加载时和图片尺寸变化时更新 shared values：

```typescript
// 在 handleImageLoad 中直接更新
imageBoundsX.value = displayX;
imageBoundsY.value = displayY;
imageBoundsWidth.value = displayWidth;
imageBoundsHeight.value = displayHeight;

// 通过 useEffect 同步更新
React.useEffect(() => {
  if (imageDimensions) {
    imageBoundsX.value = imageDimensions.x;
    imageBoundsY.value = imageDimensions.y;
    imageBoundsWidth.value = imageDimensions.width;
    imageBoundsHeight.value = imageDimensions.height;
  }
}, [imageDimensions]);
```

### 3. 在 Worklets 中使用 Shared Values

修改所有 gesture handlers，使用 shared values 替代 React state：

#### 之前（错误）：

```typescript
onActive: (event) => {
  "worklet";
  if (!imageDimensions) return; // ❌ 在 worklet 中访问 React state

  // 使用 imageDimensions.x, imageDimensions.y 等
  if (newX < imageDimensions.x) {
    newX = imageDimensions.x;
  }
};
```

#### 之后（正确）：

```typescript
onActive: (event) => {
  "worklet";

  // 使用 shared values ✅
  if (newX < imageBoundsX.value) {
    newX = imageBoundsX.value;
  }
};
```

### 4. 修改的 Handlers

所有 5 个 gesture handlers 都已修改为使用 shared values：

1. **panGestureHandler** - 移动裁剪框
2. **resizeHandlerNW** - 左上角调整大小
3. **resizeHandlerNE** - 右上角调整大小
4. **resizeHandlerSW** - 左下角调整大小
5. **resizeHandlerSE** - 右下角调整大小

每个 handler 中的所有边界检查都替换为：

- `imageDimensions.x` → `imageBoundsX.value`
- `imageDimensions.y` → `imageBoundsY.value`
- `imageDimensions.width` → `imageBoundsWidth.value`
- `imageDimensions.height` → `imageBoundsHeight.value`

### 5. 动画样式中的边界检查

`cropBoxStyle` 也使用 shared values 进行最终的边界钳位：

```typescript
const cropBoxStyle = useAnimatedStyle(() => {
  "worklet";

  // 使用 shared values 进行边界检查
  const safeX = Math.max(
    imageBoundsX.value,
    Math.min(
      imageBoundsX.value + imageBoundsWidth.value - cropWidth.value,
      cropX.value
    )
  );
  // ...
});
```

## 技术要点

### Worklet 概念

- **Worklet** 是运行在 UI 线程上的 JavaScript 函数
- 标记为 `"worklet"` 的函数会被编译并在 UI 线程上执行
- Worklet 中只能访问：
  - Shared values (`.value` 属性)
  - 函数参数
  - Worklet 内部定义的变量
  - 其他 worklet 函数

### Shared Values vs React State

| 特性         | React State  | Shared Values       |
| ------------ | ------------ | ------------------- |
| 线程         | JS 线程      | UI 线程 + JS 线程   |
| Worklet 访问 | ❌ 不可访问  | ✅ 可访问           |
| 更新方式     | `setState()` | `.value = newValue` |
| 动画性能     | 较差         | 优秀                |

## 测试要点

1. **边界约束测试**

   - ✅ 拖动裁剪框到图片边缘
   - ✅ 调整四个角到图片边界
   - ✅ 切换不同比例时保持在边界内

2. **性能测试**

   - ✅ 手势响应流畅
   - ✅ 无卡顿或跳跃
   - ✅ 动画帧率稳定

3. **比例测试**
   - ✅ 自由裁剪
   - ✅ 1:1 正方形
   - ✅ 4:3 横向
   - ✅ 16:9 横向
   - ✅ 9:16 竖向

## 修改统计

- **修改文件**: `src/components/ImageCropper.tsx`
- **新增代码**: 187 行
- **删除代码**: 71 行
- **总行数**: 889 行
- **主要改动**: 5 个 gesture handlers + 1 个动画样式 + 初始化函数

## 结论

通过使用 `react-native-reanimated` 的 shared values 机制，成功解决了 worklet 中无法访问 React state 的问题，确保裁剪框永远不会超出图片边界。这种方法不仅解决了边界约束问题，还提高了手势处理的性能。

---

**更新日期**: 2025-10-08  
**状态**: ✅ 已修复并测试通过
