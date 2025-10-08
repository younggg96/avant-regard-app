# 更新日志

## 2025-10-08: Toast 系统 + 图片裁剪器边界修复

### 🎉 主要功能

#### 1. Toast 提示系统重构

替换所有 `Alert.alert` 为底部 Toast 提示，提升用户体验。

**新增文件**:

- `src/utils/Alert.tsx` - Alert 工具类
- `src/components/ToastProvider.tsx` - Toast Provider 组件
- `src/components/ui/toast.tsx` - Toast UI 组件

**修改文件** (11 个):

- `App.tsx` - 集成 ToastProvider
- `src/screens/PublishScreen.tsx`
- `src/screens/AuthScreen.tsx`
- `src/screens/EditProfileScreen.tsx`
- `src/screens/PhoneManagementScreen.tsx`
- `src/screens/DraftsScreen.tsx`
- `src/screens/HistoryScreen.tsx`
- `src/screens/ProfileScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/ChangePasswordScreen.tsx`
- `src/screens/DesignerDetailScreen.tsx`

**Toast 特性**:

- 📍 位置: 底部弹出 (bottom: 100px)
- ⏱️ 持续时间: 默认 1 秒，可配置
- 🎨 样式: 深色背景 rgba(0,0,0,0.85)，白色文字
- ✨ 动画: 淡入淡出 + 向上平移

**使用方式**:

```typescript
import { Alert } from "../utils/Alert";

// 简单提示
Alert.show("操作成功");

// 带详情
Alert.show("提示: 请填写所有字段");

// 自定义持续时间
Alert.show("保存成功", "", 2000);
```

#### 2. 图片裁剪器边界约束修复

**问题**: 裁剪框在某些位置裁切不到，特别是在使用固定比例时无法到达图片边界

**修复内容**:

##### A. 改进所有 Resize Handlers

使用**固定锚点算法**，确保每个角落都能到达图片边界：

| 拖动角落  | 固定锚点 | 约束检查       |
| --------- | -------- | -------------- |
| 左上 (NW) | 右下角   | 左、上、右、下 |
| 右上 (NE) | 左下角   | 上、右、下     |
| 左下 (SW) | 右上角   | 左、右、下     |
| 右下 (SE) | 左上角   | 右、下         |

##### B. 添加多层边界保护

**第一层**: Gesture Handler 中的实时约束

```typescript
onActive: (event) => {
  "worklet";
  // 1. 计算新尺寸
  // 2. 应用最小尺寸
  // 3. 应用固定比例
  // 4. 计算新位置
  // 5. 边界约束检查
  // 6. 最终边界检查 (新增)
};
```

**第二层**: Animated Style 中的安全钳位

```typescript
const cropBoxStyle = useAnimatedStyle(() => {
  "worklet";
  // 使用 shared values 进行最终边界检查
  const safeX = Math.max(minX, Math.min(maxX, cropX.value));
  // ...确保显示时绝对不会超出边界
});
```

**第三层**: handleAspectChange 中的边界检查

```typescript
// 切换比例时也确保不超出边界
if (newX + newWidth > imageRight) {
  newX = imageRight - newWidth;
}
```

##### C. 新增 Shared Values

使用 shared values 存储图片边界，确保 worklet 中可以访问：

```typescript
const imageBoundsX = useSharedValue(0);
const imageBoundsY = useSharedValue(0);
const imageBoundsWidth = useSharedValue(SCREEN_WIDTH);
const imageBoundsHeight = useSharedValue(SCREEN_HEIGHT);
```

##### D. 添加 Worklet 指令

所有 gesture handlers 和 animated styles 都添加了 'worklet' 指令，提升性能。

### 📊 代码统计

**Toast 系统**:

- 新增文件: 3 个
- 修改文件: 11 个
- 总替换: ~46 处 Alert.alert 调用

**图片裁剪器**:

- 修改文件: 1 个 (ImageCropper.tsx)
- 新增代码: ~270 行
- 删除代码: ~33 行
- 文件总行数: 880 行

### 🎯 测试要点

#### Toast 系统

- [x] 提示在底部显示
- [x] 1 秒后自动关闭
- [x] 动画流畅
- [x] 不需要用户交互

#### 图片裁剪器

- [ ] 拖动四个角落都能到达图片边界
- [ ] 移动裁剪框不会超出图片
- [ ] 切换比例时裁剪框保持在图片内
- [ ] 自由裁剪和固定比例都工作正常
- [ ] 边界处拖动流畅，不卡顿

### 🔧 技术实现

#### 自定义 EventEmitter

因为 React Native 不支持 Node.js 的 `events` 模块，实现了简单的事件发射器：

```typescript
class SimpleEventEmitter {
  private listeners: { [key: string]: Function[] } = {};
  on(event: string, listener: Function) {}
  off(event: string, listener: Function) {}
  emit(event: string, data: any) {}
}
```

#### 固定锚点算法

每个 resize handler 使用对角作为固定锚点：

```typescript
// 例如：拖动左上角，右下角固定
const anchorX = startX + startWidth; // 右边固定
const anchorY = startY + startHeight; // 下边固定

// 新位置根据锚点计算
newX = anchorX - newWidth;
newY = anchorY - newHeight;
```

### 🎨 设计原则

#### DRY (Don't Repeat Yourself)

- 统一的 Toast 组件和 Alert 工具
- 相同的边界约束模式

#### KISS (Keep It Simple, Stupid)

- 简化的 API: `Alert.show(message)`
- 清晰的固定锚点算法

#### SOLID

- 单一职责: Alert 触发、ToastProvider 显示、各 handler 负责各自角落
- 开闭原则: 易于扩展新的提示类型或比例

---

**更新人员**: AI Assistant  
**更新日期**: 2025-10-08  
**状态**: ✅ 完成并待测试
